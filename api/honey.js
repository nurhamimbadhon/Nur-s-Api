const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

// MongoDB connection
let db;
let conversationsCollection;
let teachersCollection;

const connectDB = async () => {
  try {
    if (!db) {
      console.log('Connecting to MongoDB...');
      const client = new MongoClient(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      await client.connect();
      db = client.db('chatbot');
      conversationsCollection = db.collection('conversations');
      teachersCollection = db.collection('teachers');
      console.log('✅ Connected to MongoDB successfully');
    }
    return { conversationsCollection, teachersCollection };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw new Error('Database connection failed');
  }
};

// Helper function to get random response from array
const getRandomResponse = (responses) => {
  if (!responses || responses.length === 0) return null;
  return responses[Math.floor(Math.random() * responses.length)];
};

// Helper function to clean and normalize text
const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().trim();
};

// Default responses when no match found
const defaultResponses = [
  "Ahh sona ahh ata janina sikhao amake ahh💋💦",
  "Uhhhhh ata teach deo parina ata 😫💦",
  "babare aste sikhao ata parina ami💋",
  "f**k baby ata amk teach deo "
];

// Main chatbot endpoint
router.get('/', async (req, res) => {
  try {
    console.log('📝 API Request:', req.query);
    
    const { conversationsCollection, teachersCollection } = await connectDB();
    const { text, senderID, teach, reply, remove, index, list, edit, replace, react, key } = req.query;

    // Handle teaching new responses
    if (teach && reply) {
      try {
        const normalizedTeach = normalizeText(teach);
        const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
        
        if (replies.length === 0) {
          return res.json({ error: "No valid replies provided" });
        }

        // Find existing conversation or create new one
        let conversation = await conversationsCollection.findOne({ message: normalizedTeach });
        
        if (conversation) {
          // Add new replies to existing conversation
          conversation.replies = [...(conversation.replies || []), ...replies];
          conversation.teachCount = (conversation.teachCount || 0) + 1;
          conversation.lastTeacher = senderID;
          conversation.lastTaught = new Date();
          
          await conversationsCollection.updateOne(
            { message: normalizedTeach },
            { $set: conversation }
          );
        } else {
          // Create new conversation
          conversation = {
            message: normalizedTeach,
            replies: replies,
            reactions: [],
            teachCount: 1,
            teachers: [senderID],
            lastTeacher: senderID,
            lastTaught: new Date(),
            createdAt: new Date(),
            isIntro: key === 'intro'
          };
          
          await conversationsCollection.insertOne(conversation);
        }

        // Track teacher statistics
        const teacherStats = await teachersCollection.findOne({ senderID });
        if (teacherStats) {
          await teachersCollection.updateOne(
            { senderID },
            { $inc: { teachCount: 1 } }
          );
        } else {
          await teachersCollection.insertOne({
            senderID,
            teachCount: 1,
            firstTeach: new Date()
          });
        }

        return res.json({
          message: `Successfully taught! Added ${replies.length} new response(s).`,
          teacher: senderID,
          teachs: conversation.teachCount
        });
      } catch (error) {
        console.error('❌ Teach error:', error);
        return res.json({
          error: "Failed to teach",
          message: "There was an error while teaching the bot."
        });
      }
    }

    // Handle teaching reactions
    if (teach && react) {
      try {
        const normalizedTeach = normalizeText(teach);
        const reactions = react.split(',').map(r => r.trim()).filter(r => r.length > 0);
        
        let conversation = await conversationsCollection.findOne({ message: normalizedTeach });
        
        if (conversation) {
          conversation.reactions = [...(conversation.reactions || []), ...reactions];
          await conversationsCollection.updateOne(
            { message: normalizedTeach },
            { $set: conversation }
          );
        } else {
          conversation = {
            message: normalizedTeach,
            replies: [],
            reactions: reactions,
            teachCount: 1,
            teachers: [senderID],
            lastTeacher: senderID,
            lastTaught: new Date(),
            createdAt: new Date()
          };
          await conversationsCollection.insertOne(conversation);
        }

        return res.json({
          message: `Successfully taught reactions! Added ${reactions.length} new reaction(s).`
        });
      } catch (error) {
        console.error('❌ React teach error:', error);
        return res.json({
          error: "Failed to teach reactions",
          message: "There was an error while teaching reactions."
        });
      }
    }

    // Handle removing conversations
    if (remove) {
      try {
        const normalizedRemove = normalizeText(remove);
        
        if (index) {
          // Remove specific reply by index
          const conversation = await conversationsCollection.findOne({ message: normalizedRemove });
          if (conversation && conversation.replies && conversation.replies[parseInt(index) - 1]) {
            conversation.replies.splice(parseInt(index) - 1, 1);
            if (conversation.replies.length === 0) {
              await conversationsCollection.deleteOne({ message: normalizedRemove });
              return res.json({ message: "Conversation completely removed (no replies left)." });
            } else {
              await conversationsCollection.updateOne(
                { message: normalizedRemove },
                { $set: conversation }
              );
              return res.json({ message: `Reply ${index} removed successfully.` });
            }
          } else {
            return res.json({ message: "Reply not found or invalid index." });
          }
        } else {
          // Remove entire conversation
          const result = await conversationsCollection.deleteOne({ message: normalizedRemove });
          if (result.deletedCount > 0) {
            return res.json({ message: "Conversation removed successfully." });
          } else {
            return res.json({ message: "Conversation not found." });
          }
        }
      } catch (error) {
        console.error('❌ Remove error:', error);
        return res.json({
          error: "Failed to remove",
          message: "There was an error while removing the conversation."
        });
      }
    }

    // Handle editing responses
    if (edit && replace) {
      try {
        const normalizedEdit = normalizeText(edit);
        const conversation = await conversationsCollection.findOne({ message: normalizedEdit });
        
        if (conversation) {
          conversation.replies = [replace];
          conversation.lastTeacher = senderID;
          conversation.lastTaught = new Date();
          
          await conversationsCollection.updateOne(
            { message: normalizedEdit },
            { $set: conversation }
          );
          
          return res.json({ message: `Response updated successfully.` });
        } else {
          return res.json({ message: "Message not found to edit." });
        }
      } catch (error) {
        console.error('❌ Edit error:', error);
        return res.json({
          error: "Failed to edit",
          message: "There was an error while editing the response."
        });
      }
    }

    // Handle listing conversations
    if (list) {
      try {
        if (list === 'all') {
          const totalCount = await conversationsCollection.countDocuments();
          const teachers = await teachersCollection.find().toArray();
          
          const teacherList = teachers.map(teacher => ({
            [teacher.senderID]: teacher.teachCount
          }));

          return res.json({
            length: totalCount,
            teacher: {
              teacherList: teacherList
            }
          });
        } else {
          // Show specific message responses
          const conversation = await conversationsCollection.findOne({ message: normalizeText(list) });
          if (conversation && conversation.replies) {
            return res.json({
              data: conversation.replies.join(', ')
            });
          } else {
            return res.json({
              data: "No responses found for this message."
            });
          }
        }
      } catch (error) {
        console.error('❌ List error:', error);
        return res.json({
          error: "Failed to list",
          message: "There was an error while listing conversations."
        });
      }
    }

    // Handle chat responses
    if (text) {
      try {
        const normalizedText = normalizeText(text);
        
        // Special handling for intro messages
        if (key === 'intro') {
          const conversation = await conversationsCollection.findOne({ 
            message: normalizedText,
            isIntro: true 
          });
          
          if (conversation && conversation.replies && conversation.replies.length > 0) {
            return res.json({
              reply: getRandomResponse(conversation.replies)
            });
          } else {
            return res.json({
              reply: "I don't know your name yet. Can you teach me?"
            });
          }
        }

        // Look for exact match first
        let conversation = await conversationsCollection.findOne({ message: normalizedText });
        
        // If no exact match, try partial matching
        if (!conversation) {
          conversation = await conversationsCollection.findOne({
            message: { $regex: normalizedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
          });
        }

        // If still no match, try finding if any stored message is contained in the input
        if (!conversation) {
          const allConversations = await conversationsCollection.find().toArray();
          conversation = allConversations.find(conv => 
            normalizedText.includes(conv.message) || conv.message.includes(normalizedText)
          );
        }

        if (conversation && conversation.replies && conversation.replies.length > 0) {
          return res.json({
            reply: getRandomResponse(conversation.replies)
          });
        } else {
          return res.json({
            reply: getRandomResponse(defaultResponses)
          });
        }
      } catch (error) {
        console.error('❌ Chat error:', error);
        return res.json({
          reply: "Sorry, I'm having technical difficulties. Please try again."
        });
      }
    }

    // If no valid parameters provided
    return res.json({
      error: "Invalid request. Please provide valid parameters.",
      usage: {
        chat: "?text=your_message&senderID=user_id",
        teach: "?teach=message&reply=response1,response2&senderID=user_id",
        remove: "?remove=message&senderID=user_id",
        list: "?list=all or ?list=message",
        edit: "?edit=message&replace=new_response&senderID=user_id"
      }
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const { conversationsCollection } = await connectDB();
    const count = await conversationsCollection.countDocuments();
    res.json({
      status: "healthy",
      database: "connected",
      totalConversations: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get statistics
router.get('/stats', async (req, res) => {
  try {
    const { conversationsCollection, teachersCollection } = await connectDB();
    const totalConversations = await conversationsCollection.countDocuments();
    const totalTeachers = await teachersCollection.countDocuments();
    const topTeachers = await teachersCollection
      .find()
      .sort({ teachCount: -1 })
      .limit(10)
      .toArray();

    res.json({
      totalConversations,
      totalTeachers,
      topTeachers: topTeachers.map(t => ({
        senderID: t.senderID,
        teachCount: t.teachCount
      }))
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
