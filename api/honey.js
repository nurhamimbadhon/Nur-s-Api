const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// MongoDB Schema for chatbot data
const ChatDataSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    replies: [{
        type: String,
        required: true
    }],
    reactions: [{
        type: String,
        default: []
    }],
    teacher: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Schema for user introduction/names
const UserIntroSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    replies: [{
        type: String,
        required: true
    }],
    teacher: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Schema for teacher statistics
const TeacherStatsSchema = new mongoose.Schema({
    teacherId: {
        type: String,
        required: true,
        unique: true
    },
    teachCount: {
        type: Number,
        default: 0
    },
    lastTeach: {
        type: Date,
        default: Date.now
    }
});

const ChatData = mongoose.model('ChatData', ChatDataSchema);
const UserIntro = mongoose.model('UserIntro', UserIntroSchema);
const TeacherStats = mongoose.model('TeacherStats', TeacherStatsSchema);

// Helper function to get random reply
const getRandomReply = (replies) => {
    return replies[Math.floor(Math.random() * replies.length)];
};

// Helper function to update teacher stats
const updateTeacherStats = async (teacherId) => {
    try {
        await TeacherStats.findOneAndUpdate(
            { teacherId },
            { 
                $inc: { teachCount: 1 },
                $set: { lastTeach: new Date() }
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.log('Error updating teacher stats:', error);
    }
};

// Helper function to clean and normalize text
const normalizeText = (text) => {
    return text.toLowerCase().trim().replace(/[^\w\s]/gi, '');
};

// Main chatbot endpoint
router.get('/', async (req, res) => {
    try {
        const { text, senderID, teach, reply, remove, index, list, edit, replace, react, key } = req.query;

        // Handle teaching new responses
        if (teach && reply && senderID) {
            try {
                const normalizedMessage = normalizeText(teach);
                const repliesArray = reply.split(',').map(r => r.trim());
                
                // Check if it's an introduction teach
                if (key === 'intro') {
                    const existingIntro = await UserIntro.findOne({ userId: senderID });
                    
                    if (existingIntro) {
                        existingIntro.replies = [...existingIntro.replies, ...repliesArray];
                        existingIntro.teacher = senderID;
                        await existingIntro.save();
                    } else {
                        await UserIntro.create({
                            userId: senderID,
                            name: normalizedMessage,
                            replies: repliesArray,
                            teacher: senderID
                        });
                    }
                    
                    await updateTeacherStats(senderID);
                    const stats = await TeacherStats.findOne({ teacherId: senderID });
                    
                    return res.json({
                        message: `successfully for intro`,
                        teacher: senderID,
                        teachs: stats?.teachCount || 1
                    });
                }
                
                // Regular teaching
                const existingData = await ChatData.findOne({ message: normalizedMessage });
                
                if (existingData) {
                    existingData.replies = [...existingData.replies, ...repliesArray];
                    existingData.teacher = senderID;
                    existingData.updatedAt = new Date();
                    await existingData.save();
                } else {
                    await ChatData.create({
                        message: normalizedMessage,
                        replies: repliesArray,
                        teacher: senderID
                    });
                }
                
                await updateTeacherStats(senderID);
                const stats = await TeacherStats.findOne({ teacherId: senderID });
                
                return res.json({
                    message: 'successfully',
                    teacher: senderID,
                    teachs: stats?.teachCount || 1
                });
                
            } catch (error) {
                return res.json({ message: 'Error teaching: ' + error.message });
            }
        }

        // Handle teaching reactions
        if (teach && react) {
            try {
                const normalizedMessage = normalizeText(teach);
                const reactionsArray = react.split(',').map(r => r.trim());
                
                const existingData = await ChatData.findOne({ message: normalizedMessage });
                
                if (existingData) {
                    existingData.reactions = [...existingData.reactions, ...reactionsArray];
                    existingData.updatedAt = new Date();
                    await existingData.save();
                } else {
                    await ChatData.create({
                        message: normalizedMessage,
                        replies: [],
                        reactions: reactionsArray,
                        teacher: senderID || 'unknown'
                    });
                }
                
                return res.json({ message: 'successfully' });
                
            } catch (error) {
                return res.json({ message: 'Error teaching reaction: ' + error.message });
            }
        }

        // Handle removing messages
        if (remove && senderID) {
            try {
                const normalizedMessage = normalizeText(remove);
                
                if (index) {
                    // Remove specific reply by index
                    const chatData = await ChatData.findOne({ message: normalizedMessage });
                    if (chatData && chatData.replies[parseInt(index)]) {
                        chatData.replies.splice(parseInt(index), 1);
                        if (chatData.replies.length === 0) {
                            await ChatData.deleteOne({ message: normalizedMessage });
                        } else {
                            await chatData.save();
                        }
                        return res.json({ message: 'Reply removed successfully' });
                    } else {
                        return res.json({ message: 'Reply not found at that index' });
                    }
                } else {
                    // Remove entire message
                    const deleted = await ChatData.deleteOne({ message: normalizedMessage });
                    if (deleted.deletedCount > 0) {
                        return res.json({ message: 'Message removed successfully' });
                    } else {
                        return res.json({ message: 'Message not found' });
                    }
                }
            } catch (error) {
                return res.json({ message: 'Error removing: ' + error.message });
            }
        }

        // Handle editing messages
        if (edit && replace && senderID) {
            try {
                const normalizedMessage = normalizeText(edit);
                const chatData = await ChatData.findOne({ message: normalizedMessage });
                
                if (chatData) {
                    chatData.replies = [replace];
                    chatData.teacher = senderID;
                    chatData.updatedAt = new Date();
                    await chatData.save();
                    return res.json({ message: 'successfully' });
                } else {
                    return res.json({ message: 'Message not found' });
                }
            } catch (error) {
                return res.json({ message: 'Error editing: ' + error.message });
            }
        }

        // Handle listing commands
        if (list) {
            try {
                if (list === 'all') {
                    const totalCount = await ChatData.countDocuments();
                    const teacherStats = await TeacherStats.find({}).sort({ teachCount: -1 });
                    
                    const teacherList = teacherStats.map(stat => ({
                        [stat.teacherId]: stat.teachCount
                    }));
                    
                    return res.json({
                        length: totalCount,
                        teacher: {
                            teacherList: teacherList
                        }
                    });
                } else {
                    // List specific message
                    const normalizedMessage = normalizeText(list);
                    const chatData = await ChatData.findOne({ message: normalizedMessage });
                    
                    if (chatData) {
                        return res.json({
                            data: chatData.replies.join(', ')
                        });
                    } else {
                        return res.json({
                            data: 'No replies found for this message'
                        });
                    }
                }
            } catch (error) {
                return res.json({ message: 'Error listing: ' + error.message });
            }
        }

        // Handle chat responses
        if (text && senderID) {
            try {
                const normalizedText = normalizeText(text);
                
                // Check for name/intro queries
                if (key === 'intro' || normalizedText.includes('amar name') || normalizedText.includes('my name')) {
                    const userIntro = await UserIntro.findOne({ userId: senderID });
                    if (userIntro && userIntro.replies.length > 0) {
                        return res.json({
                            reply: getRandomReply(userIntro.replies)
                        });
                    }
                    return res.json({
                        reply: "আমি তোমার নাম জানি না। আমাকে শেখাও!"
                    });
                }
                
                // Search for exact match first
                let chatData = await ChatData.findOne({ message: normalizedText });
                
                // If no exact match, try partial matching
                if (!chatData) {
                    chatData = await ChatData.findOne({
                        message: { $regex: normalizedText, $options: 'i' }
                    });
                }
                
                // If still no match, try finding any message that contains words from the input
                if (!chatData) {
                    const words = normalizedText.split(' ').filter(word => word.length > 2);
                    if (words.length > 0) {
                        const regex = new RegExp(words.join('|'), 'i');
                        chatData = await ChatData.findOne({
                            message: { $regex: regex }
                        });
                    }
                }
                
                if (chatData && chatData.replies.length > 0) {
                    return res.json({
                        reply: getRandomReply(chatData.replies)
                    });
                } else {
                    // Default responses when no match found
                    const defaultReplies = [
                        "আমি বুঝতে পারছি না। আমাকে শেখাও কিভাবে উত্তর দিতে হয়!",
                        "এটা আমার জানা নেই। তুমি আমাকে শেখাতে পারো?",
                        "আমি এই বিষয়ে জানি না। আমাকে কিছু শেখাও!",
                        "Sorry, I don't understand. Can you teach me?",
                        "hmm, আমি জানি না এটার উত্তর।"
                    ];
                    
                    return res.json({
                        reply: getRandomReply(defaultReplies)
                    });
                }
                
            } catch (error) {
                return res.json({
                    reply: "কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করো!"
                });
            }
        }

        // If no valid parameters provided
        return res.json({
            message: "Please provide valid parameters",
            usage: {
                chat: "?text=yourMessage&senderID=userId",
                teach: "?teach=message&reply=response1,response2&senderID=userId",
                remove: "?remove=message&senderID=userId",
                list: "?list=all or ?list=message",
                edit: "?edit=message&replace=newResponse&senderID=userId"
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Honey API is running',
        timestamp: new Date().toISOString()
    });
});

// Stats endpoint
router.get('/stats', async (req, res) => {
    try {
        const totalMessages = await ChatData.countDocuments();
        const totalTeachers = await TeacherStats.countDocuments();
        const totalIntros = await UserIntro.countDocuments();
        
        const topTeachers = await TeacherStats.find({})
            .sort({ teachCount: -1 })
            .limit(10);
        
        res.json({
            stats: {
                totalMessages,
                totalTeachers,
                totalIntros,
                topTeachers
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
