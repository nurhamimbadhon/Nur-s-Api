const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

// MongoDB connection
let db;
let collection;

const connectDB = async () => {
  if (!db) {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db('chatbot');
    collection = db.collection('conversations');
    console.log('Connected to MongoDB');
  }
  return collection;
};

// Helper function to get random response from array
const getRandomResponse = (responses) => {
  return responses[Math.floor(Math.random() * responses.length)];
};

// Helper function to clean and normalize text
const normalizeText = (text) => {
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
    const collection = await connectDB();
    const { text, senderID, teach, reply, remove, index, list, edit, replace, react, key } = req.query;

    // Handle teaching new responses
    if (teach && reply) {
      const normalizedTeach = normalizeText(teach);
      const replies = reply.split(',').map(r => r.trim());
      
      // Find existing conversation or create new one
      let conversation = await collection.findOne({ message: normalizedTeach });
      
      if (conversation) {
        // Add new replies to existing conversation
        conversation.replies = [...conversation.replies, ...replies];
        conversation.teachCount = (conversation.teachCount || 0) + 1;
        conversation.lastTeacher = senderID;
        conversation.lastTaught = new Date();
        
        await collection.updateOne(
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
        
        await collection.insertOne(conversation);
      }

      // Track teacher statistics
      const teacherStats = await db.collection('teachers').findOne({ senderID });
      if (teacherStats) {
        await db.collection('teachers').updateOne(
          { senderID },
          { $inc: { teachCount: 1 } }
        );
      } else {
        await db.collection('teachers').insertOne({
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
    }

    // Handle teaching reactions
    if (teach && react) {
      const normalizedTeach = normalizeText(teach);
      const reactions = react.split(',').map(r => r.trim());
      
      let conversation = await collection.findOne({ message: normalizedTeach });
      
      if (conversation) {
        conversation.reactions = [...(conversation.reactions || []), ...reactions];
        await collection.updateOne(
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
        await collection.insertOne(conversation);
      }

      return res.json({
        message: `Successfully taught reactions! Added ${reactions.length} new reaction(s).`
      });
    }

    // Handle removing conversations
    if (remove) {
      const normalizedRemove = normalizeText(remove);
      
      if (index) {
        // Remove specific reply by index
        const conversation = await collection.findOne({ message: normalizedRemove });
        if (conversation && conversation.replies[parseInt(index) - 1]) {
          conversation.replies.splice(parseInt(index) - 1, 1);
          if (conversation.replies.length === 0) {
            await collection.deleteOne({ message: normalizedRemove });
            return res.json({ message: "Conversation completely removed (no replies left)." });
          } else {
            await collection.updateOne(
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
        const result = await collection.deleteOne({ message: normalizedRemove });
        if (result.deletedCount > 0) {
          return res.json({ message: "Conversation removed successfully." });
        } else {
          return res.json({ message: "Conversation not found." });
        }
      }
    }

    // Handle editing responses
    if (edit && replace) {
      const normalizedEdit = normalizeText(edit);
      const conversation = await collection.findOne({ message: normalizedEdit });
      
      if (conversation) {
        conversation.replies = [replace];
        conversation.lastTeacher = senderID;
        conversation.lastTaught = new Date();
        
        await collection.updateOne(
          { message: normalizedEdit },
          { $set: conversation }
        );
        
        return res.json({ message: `Response updated successfully.` });
      } else {
        return res.json({ message: "Message not found to edit." });
      }
    }

    // Handle listing conversations
    if (list) {
      if (list === 'all') {
        const totalCount = await collection.countDocuments();
        const teachers = await db.collection('teachers').find().toArray();
        
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
        const conversation = await collection.findOne({ message: normalizeText(list) });
        if (conversation) {
          return res.json({
            data: conversation.replies.join(', ')
          });
        } else {
          return res.json({
            data: "No responses found for this message."
          });
        }
      }
    }

    // Handle chat responses
    if (text) {
      const normalizedText = normalizeText(text);
      
      // Special handling for intro messages
      if (key === 'intro') {
        const conversation = await collection.findOne({ 
          message: normalizedText,
          isIntro: true 
        });
        
        if (conversation && conversation.replies.length > 0) {
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
      let conversation = await collection.findOne({ message: normalizedText });
      
      // If no exact match, try partial matching
      if (!conversation) {
        conversation = await collection.findOne({
          message: { $regex: normalizedText, $options: 'i' }
        });
      }

      // If still no match, try finding if any stored message is contained in the input
      if (!conversation) {
        const allConversations = await collection.find().toArray();
        conversation = allConversations.find(conv => 
          normalizedText.includes(conv.message) || conv.message.includes(normalizedText)
        );
      }

      if (conversation && conversation.replies.length > 0) {
        return res.json({
          reply: getRandomResponse(conversation.replies)
        });
      } else {
        return res.json({
          reply: getRandomResponse(defaultResponses)
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
    console.error('API Error:', error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const collection = await connectDB();
    const count = await collection.countDocuments();
    res.json({
      status: "healthy",
      database: "connected",
      totalConversations: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      error: error.message
    });
  }
});

// Get statistics
router.get('/stats', async (req, res) => {
  try {
    const collection = await connectDB();
    const totalConversations = await collection.countDocuments();
    const totalTeachers = await db.collection('teachers').countDocuments();
    const topTeachers = await db.collection('teachers')
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
