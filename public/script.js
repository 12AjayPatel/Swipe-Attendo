class AttendanceApp {
    constructor() {
        this.currentPage = 'login';
        this.teacherName = '';
        this.selectedSubject = '';
        this.students = [];
        this.attendanceRecords = [];
        this.currentStudentIndex = 0;
        this.selectedPhoto = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=400&fit=crop&crop=face';
        this.currentHistoryPage = 1;
        this.historyRecords = [];
        
        // API Configuration
        this.apiUrl = window.location.origin + '/api';
        this.token = localStorage.getItem('authToken');
        this.user = null;
        
        // Touch/Mouse events for swipe
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        this.isDragging = false;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        if (this.token) {
            this.validateTokenAndProceed();
        } else {
            this.showPage('login');
        }
    }
    
    async apiCall(endpoint, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
            },
            ...options
        };

        try {
            const response = await fetch(`${this.apiUrl}${endpoint}`, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API call failed:', error);
            if (error.message.includes('token') || error.message.includes('401')) {
                this.handleLogout();
            }
            throw error;
        }
    }

    async validateTokenAndProceed() {
        try {
            const userData = localStorage.getItem('userData');
            if (userData) {
                this.user = JSON.parse(userData);
                this.teacherName = this.user.name;
                
                if (this.user.subjects && this.user.subjects.length > 1) {
                    this.showSubjectSelection();
                } else if (this.user.subjects && this.user.subjects.length === 1) {
                    this.selectedSubject = this.user.subjects[0];
                    await this.loadStudents();
                    this.showPage('management');
                    this.updateManagementHeader();
                } else {
                    await this.loadStudents();
                    this.showPage('management');
                    this.updateManagementHeader();
                }
            }
        } catch (error) {
            console.error('Token validation failed:', error);
            this.handleLogout();
        }
    }

    showSubjectSelection() {
        const welcomeText = document.getElementById('welcomeUserText');
        const subjectSelect = document.getElementById('selectedSubject');
        
        welcomeText.textContent = `Welcome back, ${this.user.name}!`;
        
        subjectSelect.innerHTML = '<option value="">Choose a subject</option>';
        this.user.subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject;
            option.textContent = subject;
            subjectSelect.appendChild(option);
        });
        
        this.showPage('subjectSelection');
    }

    handleLogout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        this.token = null;
        this.user = null;
        this.students = [];
        this.attendanceRecords = [];
        this.historyRecords = [];
        this.showPage('login');
        this.resetLoginForms();
    }

    resetLoginForms() {
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
        document.getElementById('quickLoginForm').reset();
        this.showLoginSection();
    }

    showLoginSection() {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('registerSection').style.display = 'none';
        document.getElementById('quickLoginSection').style.display = 'none';
    }

    showRegisterSection() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('registerSection').style.display = 'block';
        document.getElementById('quickLoginSection').style.display = 'none';
    }

    showQuickLoginSection() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('registerSection').style.display = 'none';
        document.getElementById('quickLoginSection').style.display = 'block';
    }
    
    bindEvents() {
        // Authentication form events
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailLogin();
        });

        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('quickLoginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleQuickLogin();
        });

        document.getElementById('subjectSelectionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubjectSelection();
        });

        // Auth navigation buttons
        document.getElementById('showRegisterBtn').addEventListener('click', () => {
            this.showRegisterSection();
        });

        document.getElementById('showLoginBtn').addEventListener('click', () => {
            this.showLoginSection();
        });

        document.getElementById('quickLoginBtn').addEventListener('click', () => {
            this.showQuickLoginSection();
        });

        document.getElementById('backToLoginBtn').addEventListener('click', () => {
            this.showLoginSection();
        });

        // Logout buttons
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        document.getElementById('logoutFromSubjectBtn').addEventListener('click', () => {
            this.handleLogout();
        });
        
        // Management page events
        document.getElementById('addStudentBtn').addEventListener('click', () => {
            this.showAddStudentModal();
        });
        
        document.getElementById('startAttendanceBtn').addEventListener('click', () => {
            this.startAttendance();
        });

        document.getElementById('viewHistoryBtn').addEventListener('click', () => {
            this.showHistoryPage();
        });
        
        // Modal events
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideAddStudentModal();
        });
        
        document.getElementById('addStudentModal').addEventListener('click', (e) => {
            if (e.target.id === 'addStudentModal') {
                this.hideAddStudentModal();
            }
        });
        
        document.getElementById('addStudentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addStudent();
        });
        
        // Photo upload events
        document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
            document.getElementById('photoUpload').click();
        });
        
        document.getElementById('useDefaultPhotoBtn').addEventListener('click', () => {
            this.useDefaultPhoto();
        });
        
        document.getElementById('photoUpload').addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });
        
        document.getElementById('photoPreview').addEventListener('click', () => {
            document.getElementById('photoUpload').click();
        });
        
        this.bindPhotoDragAndDrop();
        
        // Attendance page events
        document.getElementById('backToManagement').addEventListener('click', () => {
            this.showPage('management');
        });
        
        document.getElementById('presentBtn').addEventListener('click', () => {
            this.markAttendance('present');
        });
        
        document.getElementById('absentBtn').addEventListener('click', () => {
            this.markAttendance('absent');
        });

        // History page events
        document.getElementById('backToManagementFromHistory').addEventListener('click', () => {
            this.showPage('management');
        });

        document.getElementById('dateFilter').addEventListener('change', () => {
            this.filterHistoryByDate();
        });

        document.getElementById('clearDateFilter').addEventListener('click', () => {
            this.clearDateFilter();
        });
        
        // Summary page events
        document.getElementById('backToManagementFromSummary').addEventListener('click', () => {
            this.showPage('management');
        });
        
        document.getElementById('retakeAttendance').addEventListener('click', () => {
            this.retakeAttendance();
        });

        document.getElementById('viewAllHistoryBtn').addEventListener('click', () => {
            this.showHistoryPage();
        });
        
        this.bindSwipeEvents();
    }

    async handleEmailLogin() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        if (email && password) {
            try {
                this.showLoading('Logging in...');
                
                const response = await this.apiCall('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password })
                });
                
                this.token = response.token;
                this.user = response.user;
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('userData', JSON.stringify(this.user));
                
                this.teacherName = this.user.name;
                
                this.hideLoading();
                
                if (this.user.subjects && this.user.subjects.length > 1) {
                    this.showSubjectSelection();
                } else if (this.user.subjects && this.user.subjects.length === 1) {
                    this.selectedSubject = this.user.subjects[0];
                    await this.loadStudents();
                    this.showPage('management');
                    this.updateManagementHeader();
                } else {
                    this.showSubjectSelection();
                }
                
            } catch (error) {
                this.hideLoading();
                this.showError('Login failed: ' + error.message);
            }
        }
    }

    async handleRegister() {
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        
        const subjectCheckboxes = document.querySelectorAll('#subjectsGrid input[type="checkbox"]:checked');
        const subjects = Array.from(subjectCheckboxes).map(cb => cb.value);
        
        if (name && email && password && subjects.length > 0) {
            try {
                this.showLoading('Creating account...');
                
                const response = await this.apiCall('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ name, email, password, subjects })
                });
                
                this.token = response.token;
                this.user = response.user;
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('userData', JSON.stringify(this.user));
                
                this.teacherName = this.user.name;
                
                this.hideLoading();
                this.showSuccess('Account created successfully!');
                
                if (this.user.subjects.length > 1) {
                    this.showSubjectSelection();
                } else {
                    this.selectedSubject = this.user.subjects[0];
                    await this.loadStudents();
                    this.showPage('management');
                    this.updateManagementHeader();
                }
                
            } catch (error) {
                this.hideLoading();
                this.showError('Registration failed: ' + error.message);
            }
        } else {
            this.showError('Please fill all fields and select at least one subject');
        }
    }

    async handleQuickLogin() {
        const teacherName = document.getElementById('teacherName').value.trim();
        const subject = document.getElementById('subject').value;
        
        if (teacherName && subject) {
            try {
                this.showLoading('Logging in...');
                
                const response = await this.apiCall('/auth/quick-login', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: teacherName,
                        subject: subject
                    })
                });
                
                this.token = response.token;
                this.user = response.user;
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('userData', JSON.stringify(this.user));
                
                this.teacherName = teacherName;
                this.selectedSubject = subject;
                
                await this.loadStudents();
                
                this.hideLoading();
                this.showPage('management');
                this.updateManagementHeader();
                
            } catch (error) {
                this.hideLoading();
                this.showError('Login failed: ' + error.message);
            }
        }
    }

    async handleSubjectSelection() {
        const subject = document.getElementById('selectedSubject').value;
        
        if (subject) {
            try {
                this.showLoading('Loading...');
                this.selectedSubject = subject;
                await this.loadStudents();
                this.hideLoading();
                this.showPage('management');
                this.updateManagementHeader();
            } catch (error) {
                this.hideLoading();
                this.showError('Failed to load data: ' + error.message);
            }
        }
    }
    
    bindPhotoDragAndDrop() {
        const photoPreview = document.getElementById('photoPreview');
        
        photoPreview.addEventListener('dragover', (e) => {
            e.preventDefault();
            photoPreview.classList.add('drag-over');
        });
        
        photoPreview.addEventListener('dragleave', (e) => {
            e.preventDefault();
            photoPreview.classList.remove('drag-over');
        });
        
        photoPreview.addEventListener('drop', (e) => {
            e.preventDefault();
            photoPreview.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files && files[0]) {
                this.processPhotoFile(files[0]);
            }
        });
    }
    
    handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processPhotoFile(file);
        }
    }
    
    processPhotoFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file');
            return;
        }
        
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError('Image file size must be less than 5MB');
            return;
        }
        
        this.showPhotoUploadLoading(true);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.compressAndSetPhoto(e.target.result);
        };
        reader.onerror = () => {
            this.showPhotoUploadLoading(false);
            this.showError('Failed to read image file');
        };
        reader.readAsDataURL(file);
    }
    
    compressAndSetPhoto(dataUrl) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const maxDimension = 400;
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxDimension) {
                    height = (height * maxDimension) / width;
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = (width * maxDimension) / height;
                    height = maxDimension;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            this.selectedPhoto = compressedDataUrl;
            this.updatePhotoPreview();
            this.showPhotoUploadLoading(false);
            this.showSuccess('Photo uploaded successfully!');
        };
        img.onerror = () => {
            this.showPhotoUploadLoading(false);
            this.showError('Failed to process image');
        };
        img.src = dataUrl;
    }
    
    useDefaultPhoto() {
        this.selectedPhoto = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=400&fit=crop&crop=face';
        this.updatePhotoPreview();
        this.showSuccess('Using default avatar');
    }
    
    updatePhotoPreview() {
        const previewImage = document.getElementById('previewImage');
        const photoPreview = document.getElementById('photoPreview');
        
        previewImage.classList.add('fade-out');
        
        setTimeout(() => {
            previewImage.src = this.selectedPhoto;
            previewImage.classList.remove('fade-out');
            photoPreview.classList.remove('error');
            photoPreview.classList.add('success');
            
            setTimeout(() => {
                photoPreview.classList.remove('success');
            }, 2000);
        }, 150);
    }
    
    showPhotoUploadLoading(show) {
        const photoPreview = document.getElementById('photoPreview');
        let loadingEl = photoPreview.querySelector('.photo-upload-loading');
        
        if (show) {
            if (!loadingEl) {
                loadingEl = document.createElement('div');
                loadingEl.className = 'photo-upload-loading';
                loadingEl.innerHTML = `
                    <div class="photo-upload-spinner"></div>
                    <div>Processing image...</div>
                `;
                photoPreview.appendChild(loadingEl);
            }
        } else {
            if (loadingEl) {
                loadingEl.remove();
            }
        }
    }
    
    bindSwipeEvents() {
        const studentCard = document.getElementById('studentCard');
        
        studentCard.addEventListener('mousedown', (e) => this.handleTouchStart(e));
        document.addEventListener('mousemove', (e) => this.handleTouchMove(e));
        document.addEventListener('mouseup', (e) => this.handleTouchEnd(e));
        
        studentCard.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        studentCard.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        studentCard.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        studentCard.addEventListener('selectstart', (e) => e.preventDefault());
        studentCard.addEventListener('contextmenu', (e) => e.preventDefault());
        studentCard.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    handleTouchStart(e) {
        if (this.currentStudentIndex >= this.students.length) return;
        
        this.isDragging = true;
        const studentCard = document.getElementById('studentCard');
        studentCard.classList.add('dragging');
        
        const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        
        this.startX = clientX;
        this.startY = clientY;
        this.currentX = clientX;
        this.currentY = clientY;
        
        e.preventDefault();
    }
    
    handleTouchMove(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        
        const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        
        this.currentX = clientX;
        this.currentY = clientY;
        
        const deltaX = this.currentX - this.startX;
        const deltaY = this.currentY - this.startY;
        
        const studentCard = document.getElementById('studentCard');
        const rotation = deltaX * 0.05;
        
        studentCard.style.transform = `translateX(${deltaX}px) translateY(${deltaY * 0.1}px) rotate(${rotation}deg)`;
        
        const swipeThreshold = 30;
        
        if (Math.abs(deltaX) > swipeThreshold) {
            if (deltaX > 0) {
                studentCard.classList.add('swipe-right');
                studentCard.classList.remove('swipe-left');
            } else {
                studentCard.classList.add('swipe-left');
                studentCard.classList.remove('swipe-right');
            }
        } else {
            studentCard.classList.remove('swipe-right', 'swipe-left');
        }
        
        const opacity = Math.min(Math.abs(deltaX) / 120, 0.4);
        if (deltaX > swipeThreshold) {
            studentCard.style.background = `linear-gradient(135deg, rgba(34, 197, 94, ${opacity}), rgba(255, 255, 255, 1))`;
        } else if (deltaX < -swipeThreshold) {
            studentCard.style.background = `linear-gradient(135deg, rgba(239, 68, 68, ${opacity}), rgba(255, 255, 255, 1))`;
        } else {
            studentCard.style.background = 'white';
        }
    }
    
    handleTouchEnd(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        const studentCard = document.getElementById('studentCard');
        studentCard.classList.remove('dragging');
        
        const deltaX = this.currentX - this.startX;
        const swipeThreshold = 50;
        
        if (Math.abs(deltaX) > swipeThreshold) {
            if (deltaX > 0) {
                this.animateSwipe('right');
            } else {
                this.animateSwipe('left');
            }
        } else {
            this.resetCardPosition();
        }
    }
    
    animateSwipe(direction) {
        const studentCard = document.getElementById('studentCard');
        const targetX = direction === 'right' ? window.innerWidth : -window.innerWidth;
        const rotation = direction === 'right' ? 30 : -30;
        
        studentCard.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        studentCard.style.transform = `translateX(${targetX}px) rotate(${rotation}deg)`;
        studentCard.style.opacity = '0';
        
        const status = direction === 'right' ? 'present' : 'absent';
        
        setTimeout(() => {
            this.markAttendance(status);
            this.resetCardPosition();
        }, 300);
    }
    
    resetCardPosition() {
        const studentCard = document.getElementById('studentCard');
        studentCard.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out, background 0.3s ease-out';
        studentCard.style.transform = 'translateX(0) translateY(0) rotate(0deg) scale(1)';
        studentCard.style.opacity = '1';
        studentCard.style.background = 'white';
        studentCard.classList.remove('swipe-right', 'swipe-left');
        
        setTimeout(() => {
            studentCard.style.transition = '';
        }, 300);
    }
    
    async loadStudents() {
        try {
            const students = await this.apiCall('/students');
            this.students = students;
            this.updateStudentsList();
        } catch (error) {
            console.error('Failed to load students:', error);
            this.showError('Failed to load students: ' + error.message);
        }
    }

    async loadAttendanceHistory(page = 1, dateFilter = null) {
        try {
            const params = new URLSearchParams({
                limit: '10',
                page: page.toString(),
                subject: this.selectedSubject
            });
            
            if (dateFilter) {
                params.append('date', dateFilter);
            }
            
            const response = await this.apiCall(`/attendance?${params.toString()}`);
            this.historyRecords = response.attendance || [];
            return response;
        } catch (error) {
            console.error('Failed to load attendance history:', error);
            this.showError('Failed to load attendance history: ' + error.message);
            return { attendance: [], pagination: { total: 0 } };
        }
    }

    async showHistoryPage() {
        this.showPage('history');
        await this.loadAndDisplayHistory();
    }

    async loadAndDisplayHistory(page = 1, dateFilter = null) {
        try {
            this.showLoading('Loading attendance history...');
            
            const response = await this.loadAttendanceHistory(page, dateFilter);
            this.currentHistoryPage = page;
            
            this.updateHistoryDisplay(response);
            this.updateHistoryStats(response.attendance);
            this.updateHistoryPagination(response.pagination);
            
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to load history: ' + error.message);
        }
    }

    updateHistoryDisplay(response) {
        const historyList = document.getElementById('historyList');
        const noHistoryMessage = document.getElementById('noHistoryMessage');
        
        if (response.attendance.length === 0) {
            historyList.style.display = 'none';
            noHistoryMessage.style.display = 'block';
            return;
        }
        
        historyList.style.display = 'block';
        noHistoryMessage.style.display = 'none';
        
        historyList.innerHTML = response.attendance.map(record => {
            const date = new Date(record.createdAt).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const time = new Date(record.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            let rateClass = 'good';
            if (record.attendanceRate < 50) rateClass = 'poor';
            else if (record.attendanceRate < 75) rateClass = 'average';
            
            return `
                <div class="history-item">
                    <div class="history-item-info">
                        <div class="history-item-date">${date} at ${time}</div>
                        <div class="history-item-stats">
                            ${record.presentCount} present, ${record.absentCount} absent 
                            (${record.totalStudents} total)
                        </div>
                    </div>
                    <div class="history-item-rate ${rateClass}">
                        ${record.attendanceRate}%
                    </div>
                </div>
            `;
        }).join('');
    }

    updateHistoryStats(records) {
        const totalSessions = document.getElementById('totalSessions');
        const avgAttendanceRate = document.getElementById('avgAttendanceRate');
        
        totalSessions.textContent = records.length;
        
        if (records.length > 0) {
            const avgRate = records.reduce((sum, record) => sum + record.attendanceRate, 0) / records.length;
            avgAttendanceRate.textContent = `${Math.round(avgRate)}%`;
        } else {
            avgAttendanceRate.textContent = '0%';
        }
    }

    updateHistoryPagination(pagination) {
        const paginationContainer = document.getElementById('historyPagination');
        
        if (pagination.totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }
        
        paginationContainer.style.display = 'flex';
        
        const buttons = [];
        
        if (pagination.page > 1) {
            buttons.push(`<button onclick="window.app.loadAndDisplayHistory(${pagination.page - 1})" class="page-btn">← Previous</button>`);
        }
        
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.totalPages, pagination.page + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === pagination.page ? 'active' : '';
            buttons.push(`<button onclick="window.app.loadAndDisplayHistory(${i})" class="page-btn ${activeClass}">${i}</button>`);
        }
        
        if (pagination.page < pagination.totalPages) {
            buttons.push(`<button onclick="window.app.loadAndDisplayHistory(${pagination.page + 1})" class="page-btn">Next →</button>`);
        }
        
        paginationContainer.innerHTML = buttons.join('');
    }

    async filterHistoryByDate() {
        const dateFilter = document.getElementById('dateFilter').value;
        if (dateFilter) {
            await this.loadAndDisplayHistory(1, dateFilter);
        }
    }

    async clearDateFilter() {
        document.getElementById('dateFilter').value = '';
        await this.loadAndDisplayHistory(1);
    }
    
    updateManagementHeader() {
        document.getElementById('welcomeText').textContent = `Welcome, ${this.teacherName}!`;
        document.getElementById('subjectText').textContent = `Managing attendance for ${this.selectedSubject}`;
        document.getElementById('studentCount').textContent = this.students.length;
    }
    
    showAddStudentModal() {
        document.getElementById('addStudentModal').classList.add('active');
        this.resetAddStudentForm();
    }
    
    hideAddStudentModal() {
        document.getElementById('addStudentModal').classList.remove('active');
    }
    
    
    async addStudent() {
        const name = document.getElementById('newStudentName').value.trim();
        const rollNumber = document.getElementById('newStudentRoll').value.trim();
        const studentClass = document.getElementById('newStudentClass').value.trim();
        const section = document.getElementById('newStudentSection').value.trim();
        const age = parseInt(document.getElementById('newStudentAge').value);
        const gender = document.getElementById('newStudentGender').value;
        
        if (name && rollNumber && studentClass && section && age && gender) {
            try {
                this.showLoading('Adding student...');
                
                const studentData = {
                    name,
                    rollNumber,
                    class: studentClass,
                    section,
                    age,
                    gender,
                    photo: this.selectedPhoto
                };
                
                const newStudent = await this.apiCall('/students', {
                    method: 'POST',
                    body: JSON.stringify(studentData)
                });
                
                this.students.push(newStudent);
                this.updateStudentsList();
                this.updateManagementHeader();
                this.hideAddStudentModal();
                this.hideLoading();
                this.showSuccess('Student added successfully!');
                
            } catch (error) {
                this.hideLoading();
                this.showError('Failed to add student: ' + error.message);
            }
        }
    }
    
    updateStudentsList() {
        const container = document.getElementById('studentsList');
        const noStudentsMessage = document.getElementById('noStudentsMessage');
        const startAttendanceContainer = document.getElementById('startAttendanceContainer');
        
        if (this.students.length === 0) {
            container.innerHTML = '';
            noStudentsMessage.style.display = 'block';
            startAttendanceContainer.style.display = 'none';
        } else {
            noStudentsMessage.style.display = 'none';
            startAttendanceContainer.style.display = 'block';
            
            container.innerHTML = this.students.map(student => `
                <div class="student-card-preview">
                    <img src="${student.photo}" alt="${student.name}" onerror="this.src='https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=400&fit=crop&crop=face'">
                    <div class="student-preview-info">
                        <h3>${student.name}</h3>
                        <p>Roll: ${student.rollNumber}</p>
                        <p>Class ${student.class}-${student.section} • Age ${student.age}</p>
                    </div>
                </div>
            `).join('');
        }
    }
    
    startAttendance() {
        this.attendanceRecords = [];
        this.currentStudentIndex = 0;
        this.showPage('attendance');
        this.updateAttendanceDisplay();
    }
    
    updateAttendanceDisplay() {
        if (this.currentStudentIndex >= this.students.length) {
            this.showSummary();
            return;
        }
        
        const student = this.students[this.currentStudentIndex];
        const progressPercent = ((this.currentStudentIndex + 1) / this.students.length) * 100;
        
        document.getElementById('progressText').textContent = `${this.currentStudentIndex + 1} of ${this.students.length}`;
        document.getElementById('progressFill').style.width = `${progressPercent}%`;
        
        document.getElementById('studentPhoto').src = student.photo;
        document.getElementById('studentPhoto').onerror = function() {
            this.src = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=400&fit=crop&crop=face';
        };
        document.getElementById('studentName').textContent = student.name;
        document.getElementById('studentRoll').textContent = student.rollNumber;
        document.getElementById('studentClass').textContent = `${student.class}-${student.section}`;
        document.getElementById('studentAge').textContent = `${student.age} years`;
        document.getElementById('studentGender').textContent = student.gender;
        
        this.resetCardPosition();
    }
    
    markAttendance(status) {
        if (this.currentStudentIndex >= this.students.length) return;
        
        const student = this.students[this.currentStudentIndex];
        this.attendanceRecords.push({
            studentId: student._id,
            status: status
        });
        
        this.currentStudentIndex++;
        
        setTimeout(() => {
            this.updateAttendanceDisplay();
        }, 300);
    }
    
    retakeAttendance() {
        this.startAttendance();
    }
    
    async showSummary() {
        this.showPage('summary');
        
        try {
            this.showLoading('Saving attendance...');
            
            const attendanceData = {
                subject: this.selectedSubject,
                students: this.attendanceRecords
            };
            
            const savedAttendance = await this.apiCall('/attendance', {
                method: 'POST',
                body: JSON.stringify(attendanceData)
            });
            
            this.hideLoading();
            this.updateSummaryDisplay();
            await this.loadRecentRecords();
            this.showSuccess('Attendance saved successfully!');
            
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to save attendance: ' + error.message);
            this.updateSummaryDisplay();
        }
    }

    async loadRecentRecords() {
        try {
            const response = await this.apiCall('/dashboard/stats');
            this.updateRecentRecords(response.recentAttendance || []);
            
            const totalRecordsCount = document.getElementById('totalRecordsCount');
            totalRecordsCount.textContent = response.totalAttendanceRecords || 0;
            
        } catch (error) {
            console.error('Failed to load recent records:', error);
        }
    }

    updateRecentRecords(recentRecords) {
        const recentRecordsList = document.getElementById('recentRecordsList');
        
        if (recentRecords.length === 0) {
            recentRecordsList.innerHTML = '<p style="color: #666; text-align: center;">No recent records found</p>';
            return;
        }
        
        recentRecordsList.innerHTML = recentRecords.map(record => {
            const date = new Date(record.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="recent-item">
                    <div class="recent-item-info">
                        <div class="recent-item-date">${date}</div>
                        <div class="recent-item-stats">
                            ${record.presentCount} present, ${record.absentCount} absent
                        </div>
                    </div>
                    <div class="recent-item-rate">${record.attendanceRate}%</div>
                </div>
            `;
        }).join('');
    }
    
    updateSummaryDisplay() {
        const presentStudents = this.attendanceRecords.filter(record => record.status === 'present');
        const absentStudents = this.attendanceRecords.filter(record => record.status === 'absent');
        const attendanceRate = this.students.length > 0 ? Math.round((presentStudents.length / this.students.length) * 100) : 0;
        
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('summaryDate').textContent = `${this.selectedSubject} • ${currentDate}`;
        
        document.getElementById('totalStudents').textContent = this.students.length;
        document.getElementById('presentCount').textContent = presentStudents.length;
        document.getElementById('absentCount').textContent = absentStudents.length;
        document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;
        
        document.getElementById('presentListCount').textContent = presentStudents.length;
        document.getElementById('absentListCount').textContent = absentStudents.length;
        
        this.updateStudentList('presentList', presentStudents, 'present');
        this.updateStudentList('absentList', absentStudents, 'absent');
    }
    
    updateStudentList(containerId, records, status) {
        const container = document.getElementById(containerId);
        const statusIcon = status === 'present' ? '✅' : '❌';
        
        container.innerHTML = records.map(record => {
            const student = this.students.find(s => s._id === record.studentId);
            if (!student) return '';
            
            return `
                <div class="student-list-item ${status}">
                    <img src="${student.photo}" alt="${student.name}" onerror="this.src='https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=400&fit=crop&crop=face'">
                    <div class="student-list-info">
                        <div>${student.name}</div>
                        <div>Roll: ${student.rollNumber}</div>
                    </div>
                    <div class="student-list-status">${statusIcon}</div>
                </div>
            `;
        }).join('');
    }
    
    showPage(pageName) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        document.getElementById(`${pageName}Page`).classList.add('active');
        this.currentPage = pageName;
    }
    
    showLoading(message = 'Loading...') {
        let loadingOverlay = document.getElementById('loadingOverlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loadingOverlay';
            loadingOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                color: white;
                font-size: 1.2rem;
                font-weight: 500;
            `;
            document.body.appendChild(loadingOverlay);
        }
        
        loadingOverlay.innerHTML = `
            <div style="text-align: center;">
                <div style="width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                <div>${message}</div>
            </div>
        `;
        loadingOverlay.style.display = 'flex';
        
        if (!document.getElementById('spinAnimation')) {
            const style = document.createElement('style');
            style.id = 'spinAnimation';
            style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    }
    
    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    
    showSuccess(message) {
        this.showToast(message, 'success');
    }
    
    showError(message) {
        this.showToast(message, 'error');
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 10001;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideInRight 0.3s ease-out;
            ${type === 'success' ? 'background: linear-gradient(135deg, #22c55e, #16a34a);' : ''}
            ${type === 'error' ? 'background: linear-gradient(135deg, #ef4444, #dc2626);' : ''}
            ${type === 'info' ? 'background: linear-gradient(135deg, #3b82f6, #2563eb);' : ''}
        `;
        toast.textContent = message;
        
        if (!document.getElementById('toastAnimations')) {
            const style = document.createElement('style');
            style.id = 'toastAnimations';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
        
        toast.addEventListener('click', () => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
    }
}

// Global app instance
window.app = null;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AttendanceApp();
});