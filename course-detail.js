// Course data
const courses = {
    'web-development': {
        title: 'Web Development',
        description: 'Learn modern web development technologies including HTML, CSS, JavaScript, and popular frameworks. This comprehensive course covers both frontend and backend development, preparing you for a career in web development.',
        duration: '12 weeks',
        prerequisites: 'Basic computer skills and familiarity with using a computer. No prior programming experience required.',
        objectives: [
            'Master HTML5 and CSS3 for creating responsive web pages',
            'Learn JavaScript fundamentals and advanced concepts',
            'Understand frontend frameworks like React or Vue',
            'Build backend applications with Node.js',
            'Work with databases and APIs',
            'Deploy web applications to production'
        ],
        curriculum: [
            'Week 1-2: HTML5 and CSS3 Fundamentals',
            'Week 3-4: JavaScript Basics and DOM Manipulation',
            'Week 5-6: Advanced JavaScript and ES6+ Features',
            'Week 7-8: Frontend Framework (React/Vue)',
            'Week 9-10: Backend Development with Node.js',
            'Week 11: Database Integration and APIs',
            'Week 12: Deployment and Project Work'
        ]
    },
    'software-engineering': {
        title: 'Software Engineering',
        description: 'Master software development principles, design patterns, and best practices. This course covers the entire software development lifecycle, from planning to deployment.',
        duration: '16 weeks',
        prerequisites: 'Basic programming knowledge in any language. Understanding of fundamental programming concepts.',
        objectives: [
            'Understand software development methodologies',
            'Learn design patterns and architectural principles',
            'Master version control and collaboration tools',
            'Practice test-driven development',
            'Learn software documentation and maintenance',
            'Understand deployment and DevOps basics'
        ],
        curriculum: [
            'Week 1-2: Software Development Lifecycle',
            'Week 3-4: Programming Fundamentals Review',
            'Week 5-6: Object-Oriented Design Principles',
            'Week 7-8: Design Patterns',
            'Week 9-10: Version Control and Collaboration',
            'Week 11-12: Testing and Quality Assurance',
            'Week 13-14: Software Architecture',
            'Week 15-16: Project Development and Deployment'
        ]
    },
    'data-science': {
        title: 'Data Science',
        description: 'Explore data analysis, machine learning, and statistical methods for making data-driven decisions. Learn to work with real-world datasets and build predictive models.',
        duration: '14 weeks',
        prerequisites: 'Basic mathematics and statistics knowledge. Familiarity with programming concepts is helpful but not required.',
        objectives: [
            'Learn data collection and preprocessing techniques',
            'Master statistical analysis and visualization',
            'Understand machine learning algorithms',
            'Build predictive models',
            'Work with large datasets',
            'Communicate data insights effectively'
        ],
        curriculum: [
            'Week 1-2: Introduction to Data Science and Python',
            'Week 3-4: Data Collection and Preprocessing',
            'Week 5-6: Exploratory Data Analysis',
            'Week 7-8: Statistical Analysis',
            'Week 9-10: Machine Learning Fundamentals',
            'Week 11-12: Advanced Machine Learning',
            'Week 13: Data Visualization and Communication',
            'Week 14: Capstone Project'
        ]
    },
    'cybersecurity': {
        title: 'Cybersecurity',
        description: 'Understand security principles, threat analysis, and protection strategies. Learn to protect systems and networks from cyber threats.',
        duration: '12 weeks',
        prerequisites: 'Basic understanding of computer networks and operating systems. General IT knowledge recommended.',
        objectives: [
            'Understand cybersecurity fundamentals',
            'Learn threat identification and analysis',
            'Master network security principles',
            'Understand encryption and cryptography',
            'Learn incident response procedures',
            'Practice ethical hacking techniques'
        ],
        curriculum: [
            'Week 1-2: Cybersecurity Fundamentals',
            'Week 3-4: Network Security',
            'Week 5-6: Cryptography and Encryption',
            'Week 7-8: Threat Analysis and Vulnerability Assessment',
            'Week 9-10: Security Tools and Technologies',
            'Week 11: Incident Response and Recovery',
            'Week 12: Ethical Hacking and Penetration Testing'
        ]
    },
    'cloud-computing': {
        title: 'Cloud Computing',
        description: 'Learn cloud platforms, infrastructure, and deployment strategies. Master AWS, Azure, or Google Cloud Platform services.',
        duration: '10 weeks',
        prerequisites: 'Basic understanding of networking and system administration. Familiarity with Linux command line helpful.',
        objectives: [
            'Understand cloud computing concepts and models',
            'Learn major cloud platforms (AWS/Azure/GCP)',
            'Master cloud infrastructure management',
            'Understand containerization and orchestration',
            'Learn cloud security best practices',
            'Deploy and manage cloud applications'
        ],
        curriculum: [
            'Week 1-2: Cloud Computing Fundamentals',
            'Week 3-4: Cloud Platform Overview (AWS/Azure/GCP)',
            'Week 5-6: Compute and Storage Services',
            'Week 7: Networking and Security in Cloud',
            'Week 8: Containerization (Docker)',
            'Week 9: Orchestration (Kubernetes)',
            'Week 10: Cloud Deployment and Management'
        ]
    },
    'mobile-app': {
        title: 'Mobile App Development',
        description: 'Build mobile applications for iOS and Android platforms. Learn native and cross-platform development approaches.',
        duration: '14 weeks',
        prerequisites: 'Basic programming knowledge. Understanding of object-oriented programming concepts.',
        objectives: [
            'Learn mobile app development fundamentals',
            'Master native iOS or Android development',
            'Understand cross-platform frameworks',
            'Design user interfaces for mobile',
            'Integrate APIs and backend services',
            'Publish apps to app stores'
        ],
        curriculum: [
            'Week 1-2: Mobile Development Fundamentals',
            'Week 3-4: Platform-Specific Development (iOS/Android)',
            'Week 5-6: User Interface Design',
            'Week 7-8: App Architecture and State Management',
            'Week 9-10: API Integration and Backend Services',
            'Week 11-12: Advanced Features and Optimization',
            'Week 13: Testing and Debugging',
            'Week 14: App Store Deployment'
        ]
    }
};

// Load course details based on URL parameter
function loadCourseDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('course');

    if (courseId && courses[courseId]) {
        const course = courses[courseId];

        document.getElementById('course-title').textContent = course.title;
        document.getElementById('course-description').textContent = course.description;
        document.getElementById('course-duration').textContent = course.duration;
        document.getElementById('course-prerequisites').textContent = course.prerequisites;

        const objectivesList = document.getElementById('course-objectives');
        objectivesList.innerHTML = '';
        course.objectives.forEach(objective => {
            const li = document.createElement('li');
            li.textContent = objective;
            objectivesList.appendChild(li);
        });

        const curriculumDiv = document.getElementById('course-curriculum');
        curriculumDiv.innerHTML = '<ul>';
        course.curriculum.forEach(item => {
            curriculumDiv.innerHTML += `<li>${item}</li>`;
        });
        curriculumDiv.innerHTML += '</ul>';
    } else {
        // Default course if no parameter or invalid course
        document.getElementById('course-title').textContent = 'Course Not Found';
        document.getElementById('course-description').textContent = 'The requested course could not be found. Please return to the courses page.';
    }
}

// Load course details when page loads
document.addEventListener('DOMContentLoaded', loadCourseDetails);


