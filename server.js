const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_db', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB successfully');
});

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    subjects: [{ type: String, required: true }]
}, { timestamps: true });

// Student Schema
const studentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    class: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 5, max: 25 },
    gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
    photo: { type: String, default: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=400&fit=crop&crop=face' },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Attendance Record Schema
const attendanceSchema = new mongoose.Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    date: { type: Date, default: Date.now },
    students: [{
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
        status: { type: String, enum: ['present', 'absent'], required: true }
    }],
    totalStudents: { type: Number, required: true },
    presentCount: { type: Number, required: true },
    absentCount: { type: Number, required: true },
    attendanceRate: { type: Number, required: true }
}, { timestamps: true });

// TTL Index for automatic deletion after 30 days
attendanceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const User = mongoose.model('User', userSchema);
const Student = mongoose.model('Student', studentSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

// JWT Authentication Middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token' });
    }
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, subjects } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const user = new User({ name, email, password: hashedPassword, subjects: subjects || [] });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '30d' });

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: user._id, name: user.name, email: user.email, subjects: user.subjects }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '30d' });

        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, name: user.name, email: user.email, subjects: user.subjects }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.post('/api/auth/quick-login', async (req, res) => {
    try {
        const { name, subject } = req.body;

        if (!name || !subject) {
            return res.status(400).json({ message: 'Name and subject are required' });
        }

        const tempEmail = `${name.toLowerCase().replace(/\s+/g, '')}@temp.com`;
        
        let user = await User.findOne({ email: tempEmail });
        
        if (!user) {
            const hashedPassword = await bcrypt.hash('defaultpass123', 10);
            user = new User({ name, email: tempEmail, password: hashedPassword, subjects: [subject] });
            await user.save();
        } else {
            if (!user.subjects.includes(subject)) {
                user.subjects.push(subject);
                await user.save();
            }
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '30d' });

        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, name: user.name, email: user.email, subjects: user.subjects }
        });
    } catch (error) {
        console.error('Quick login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Student Routes
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const students = await Student.find({ teacherId: req.user._id }).sort({ createdAt: -1 });
        res.json(students);
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ message: 'Error fetching students' });
    }
});

app.post('/api/students', authenticateToken, async (req, res) => {
    try {
        const { name, rollNumber, class: studentClass, section, age, gender, photo } = req.body;

        const existingStudent = await Student.findOne({ rollNumber, teacherId: req.user._id });

        if (existingStudent) {
            return res.status(400).json({ message: 'Student with this roll number already exists' });
        }

        const student = new Student({
            name, rollNumber, class: studentClass, section, age, gender,
            photo: photo || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=400&fit=crop&crop=face',
            teacherId: req.user._id
        });

        await student.save();
        res.status(201).json(student);
    } catch (error) {
        console.error('Create student error:', error);
        res.status(500).json({ message: 'Error creating student' });
    }
});

app.put('/api/students/:id', authenticateToken, async (req, res) => {
    try {
        const student = await Student.findOneAndUpdate(
            { _id: req.params.id, teacherId: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json(student);
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ message: 'Error updating student' });
    }
});

app.delete('/api/students/:id', authenticateToken, async (req, res) => {
    try {
        const student = await Student.findOneAndDelete({
            _id: req.params.id,
            teacherId: req.user._id
        });

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ message: 'Error deleting student' });
    }
});

// Attendance Routes
app.post('/api/attendance', authenticateToken, async (req, res) => {
    try {
        const { subject, students } = req.body;

        if (!subject || !students || !Array.isArray(students)) {
            return res.status(400).json({ message: 'Subject and students array are required' });
        }

        const totalStudents = students.length;
        const presentCount = students.filter(s => s.status === 'present').length;
        const absentCount = students.filter(s => s.status === 'absent').length;
        const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

        const attendance = new Attendance({
            teacherId: req.user._id,
            subject,
            students,
            totalStudents,
            presentCount,
            absentCount,
            attendanceRate
        });

        await attendance.save();
        
        const populatedAttendance = await Attendance.findById(attendance._id)
            .populate('students.studentId', 'name rollNumber class section');

        res.status(201).json(populatedAttendance);
    } catch (error) {
        console.error('Create attendance error:', error);
        res.status(500).json({ message: 'Error saving attendance' });
    }
});

app.get('/api/attendance', authenticateToken, async (req, res) => {
    try {
        const { subject, date, limit = 20, page = 1 } = req.query;
        const filter = { teacherId: req.user._id };

        if (subject) filter.subject = subject;

        if (date) {
            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            filter.date = { $gte: startDate, $lte: endDate };
        }

        const skip = (page - 1) * limit;
        
        const attendance = await Attendance.find(filter)
            .populate('students.studentId', 'name rollNumber class section')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Attendance.countDocuments(filter);

        res.json({
            attendance,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ message: 'Error fetching attendance records' });
    }
});

// Dashboard Routes
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const totalStudents = await Student.countDocuments({ teacherId: req.user._id });
        const totalAttendanceRecords = await Attendance.countDocuments({ teacherId: req.user._id });
        
        const recentAttendance = await Attendance.find({ teacherId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('students.studentId', 'name');

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const weeklyAttendance = await Attendance.find({
            teacherId: req.user._id,
            createdAt: { $gte: weekAgo }
        });

        const averageAttendanceRate = weeklyAttendance.length > 0
            ? weeklyAttendance.reduce((sum, record) => sum + record.attendanceRate, 0) / weeklyAttendance.length
            : 0;

        res.json({
            totalStudents,
            totalAttendanceRecords,
            averageAttendanceRate: Math.round(averageAttendanceRate),
            recentAttendance
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: 'Error fetching dashboard statistics' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        message: 'Swipe Attendance System is running!'
    });
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});