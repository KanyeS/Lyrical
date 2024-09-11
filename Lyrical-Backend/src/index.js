const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const uuid = require('uuid');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const { Midi } = require('@tonejs/midi');
const mysql = require('mysql2/promise');

console.log('Loaded Environment Variables:', {
    JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
    FLASK_API_URL: process.env.FLASK_API_URL
});

const FLASK_API_URL = process.env.FLASK_API_URL;

const app = express();
// Use environment variable for allowed origin
const allowedOrigin = process.env.NODE_ALLOWED_ORIGIN || 'http://localhost';

const corsOptions = {
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Database connection
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'your_user',
    password: process.env.DB_PASSWORD || 'your_password',
    database: process.env.DB_NAME || 'your_database_name'
});

// Function to check the connection to the database
async function checkDatabaseConnection() {
    try {
        // Attempt to establish a connection
        await db.getConnection();
        console.log("Successfully connected to the database.");
        return true;  // Return true if the connection is successful
    } catch (err) {
        console.error("Failed to connect to the database:", err);
        return false; // Return false if there's an issue with the connection
    }
}

// Function to check the connection to the database with retries
async function checkDatabaseConnection(retries = 100, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            // Attempt to establish a connection
            await db.getConnection();
            console.log("Successfully connected to the database.");
            return true;  // Return true if the connection is successful
        } catch (err) {
            console.error(`Database connection failed. Attempt ${i + 1} of ${retries}. Retrying in ${delay / 1000} seconds...`);
            if (i === retries - 1) {
                console.error("Max retries reached. Could not connect to the database.");
                return false;
            }
            // Wait for the specified delay before retrying
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

// Function to initialize the database tables
async function initializeDatabase() {
    // Check the connection before creating the tables
    const isConnected = await checkDatabaseConnection();

    if (isConnected) {
        try {
            // Create 'users' table if it doesn't exist
            await db.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    Username VARCHAR(255) NOT NULL,
                    Email VARCHAR(255) NOT NULL,
                    PasswordHash VARCHAR(255) NOT NULL,
                    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Create 'sequences' table if it doesn't exist
            await db.execute(`
                CREATE TABLE IF NOT EXISTS sequences (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    UserId VARCHAR(255) NOT NULL,
                    SequenceId VARCHAR(255) NOT NULL,
                    FilePath VARCHAR(255) NOT NULL,
                    Metadata TEXT,
                    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            console.log("Tables initialized successfully.");
        } catch (err) {
            console.error("Error initializing database tables:", err);
            throw err;
        }
    } else {
        console.error("Database connection failed. Skipping table creation.");
    }
}

// Call this function on startup
initializeDatabase();

// Secret key for JWT encoding/decoding
const SECRET_KEY = process.env.JWT_SECRET_KEY;

// Function to create MIDI from notes
function createMidiFromNotes(notes, outputMidiPath, tempo = 120) {
    const midi = new Midi();
    midi.header.setTempo(tempo);
    const track = midi.addTrack();

    notes.forEach(note => {
        track.addNote({
            midi: parseInt(note.pitch),
            time: note.start_time,
            duration: note.end_time - note.start_time,
            velocity: 0.8
        });
    });

    fs.writeFileSync(outputMidiPath, Buffer.from(midi.toArray()));
}

// Save sequence metadata to SQL
async function saveSequenceToSQL(userId, sequenceId, filePath, metadata) {
    const createdAt = formatDateForSQL(new Date());  // Add creation timestamp
    const sql = 'INSERT INTO sequences (UserId, SequenceId, FilePath, Metadata, CreatedAt) VALUES (?, ?, ?, ?, ?)';
    try {
        await db.execute(sql, [userId, sequenceId, filePath, JSON.stringify(metadata), createdAt]);
        console.log("Sequence saved successfully to SQL!");
    } catch (err) {
        console.error("Error saving to SQL:", err);
        throw err;
    }
}

// Function to delete a sequence from SQL
async function deleteSequenceFromSQL(sequenceId, userId) {
    const sql = 'DELETE FROM sequences WHERE SequenceId = ? AND UserId = ?';
    try {
        const [result] = await db.execute(sql, [sequenceId, userId]);
        if (result.affectedRows > 0) {
            console.log(`Sequence with ID ${sequenceId} deleted successfully.`);
            return true;
        } else {
            console.log(`No sequence found with ID ${sequenceId} for user ${userId}.`);
            return false;
        }
    } catch (err) {
        console.error("Error deleting sequence from SQL:", err);
        throw err;
    }
}

// Get user notes from SQL
async function getUserNotes(userId) {
    const sql = 'SELECT * FROM sequences WHERE UserId = ?';
    try {
        const [rows] = await db.execute(sql, [userId]);
        return rows;
    } catch (err) {
        console.error("Error fetching user notes from SQL:", err);
        throw err;
    }
}

// Utility function to generate a JWT token
function generateAccessToken(username) {
    const payload = { username, exp: Math.floor(Date.now() / 1000) + (60 * 30) };
    return jwt.sign(payload, SECRET_KEY);
}

// Middleware to verify a token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Token is missing" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = user;
        next();
    });
}

// Convert ISO string to MySQL DATETIME format
function formatDateForSQL(date) {
    return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
  }

// User registration route
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = formatDateForSQL(new Date());

    const sql = 'INSERT INTO users (Username, Email, PasswordHash, CreatedAt) VALUES (?, ?, ?, ?)';
    try {
        await db.execute(sql, [username, email, passwordHash, createdAt]);
        res.json({ message: "User registered successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Login route to authenticate the user and provide a token
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE Username = ?', [username]);
        const user = rows[0];

        if (user && await bcrypt.compare(password, user.PasswordHash)) {
            const token = generateAccessToken(username);
            res.json({ token });
        } else {
            res.status(401).json({ message: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ message: "Internal Server Error", error: err.message });
    }
});

// Endpoint to submit notes and generate melody variations using Flask
app.post('/submit_notes', authenticateToken, async (req, res) => {
    const { notes, tempo = 120, length = 30, format = 'mp3', variations = 2 } = req.body;

    try {
        const response = await axios.post(`${process.env.FLASK_API_URL}/generate_melody`, { notes, tempo, length, variations });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint to generate audio from notes using Flask
app.post('/generate_audio', authenticateToken, async (req, res) => {
    const { notes, tempo = 120 } = req.body;

    try {
        const response = await axios.post(`${process.env.FLASK_API_URL}/generate_audio`, { notes, tempo }, { responseType: 'arraybuffer' });
        res.set('Content-Type', 'audio/wav');
        res.set('Content-Disposition', 'attachment; filename="output_sequence.wav"');
        res.send(response.data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint to fetch saved notes for the authenticated user
app.get('/api/saved_notes', authenticateToken, async (req, res) => {
    const userId = req.user.username;

    try {
        const notes = await getUserNotes(userId);
        res.json({ notes });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint to save sequence and metadata
app.post('/save_sequence', authenticateToken, async (req, res) => {
    const { notes } = req.body;
    const userId = req.user.username;
    const sequenceId = uuid.v4();
    const midiFileName = `${userId}-${sequenceId}.mid`;

    const localDir = path.join('/tmp', userId);
    fs.mkdirSync(localDir, { recursive: true });

    const outputMidiPath = path.join(localDir, `${sequenceId}.mid`);
    createMidiFromNotes(notes, outputMidiPath, 120);

    try {
        await saveSequenceToSQL(userId, sequenceId, midiFileName, { notes });
        res.json({ message: "Sequence saved successfully", file_name: midiFileName });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint to handle file download requests
app.get('/download', authenticateToken, async (req, res) => {
    const { file } = req.query;

    if (!file) {
        return res.status(400).json({ message: "No file specified" });
    }

    try {
        // Forward the request to the Flask API for file download
        const response = await axios.get(`${FLASK_API_URL}/download`, {
            params: { file },
            headers: {
                'Authorization': req.headers['authorization'] // Forward the token
            },
            responseType: 'stream' // Important to handle the file stream
        });

        // Set the headers to indicate a file download
        res.setHeader('Content-Disposition', `attachment; filename=${file.split('/').pop()}`);
        response.data.pipe(res); // Pipe the Flask response stream to the client

    } catch (error) {
        console.error('Error downloading file:', error.message);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});

// Endpoint to delete a sequence by SequenceId
app.delete('/api/delete_note', authenticateToken, async (req, res) => {
    const { sequenceId } = req.body;
    const userId = req.user.username;

    if (!sequenceId) {
        return res.status(400).json({ message: "SequenceId is required" });
    }

    try {
        const success = await deleteSequenceFromSQL(sequenceId, userId);
        if (success) {
            res.json({ message: "Sequence deleted successfully" });
        } else {
            res.status(404).json({ message: "Sequence not found" });
        }
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
});


// Run the Node.js server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
