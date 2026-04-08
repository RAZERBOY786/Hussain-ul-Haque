import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';

// Ensure Tailwind CSS is loaded for styling
// <script src="https://cdn.tailwindcss.com"></script>
// This is assumed to be available in the Canvas environment for React apps.

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Hardcoded initial admin credentials for demonstration purposes
// In a real application, these would be securely stored and managed on a backend.
const SIMULATED_ADMINS = [
  { adminId: 'admin1', password: 'password1', role: 'super-admin', name: 'Super Admin One' },
  { adminId: 'admin2', password: 'password2', role: 'regular-admin', name: 'Regular Admin Two' },
];

function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState(null); // { adminId, role, name }
  const [activeTab, setActiveTab] = useState('books');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalAction, setModalAction] = useState(null); // Function to execute on modal confirm

  // State for Books
  const [books, setBooks] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [editingBook, setEditingBook] = useState(null); // null or book object
  const [editingPublisher, setEditingPublisher] = useState(null); // null or publisher object
  const [bookDescriptionInput, setBookDescriptionInput] = useState(''); // For LLM interaction
  const [isGeneratingBookDescription, setIsGeneratingBookDescription] = useState(false);


  // State for Research
  const [scholarlyWorks, setScholarlyWorks] = useState([]);
  const [completedWorks, setCompletedWorks] = useState([]);
  const [editingScholarlyWork, setEditingScholarlyWork] = useState(null); // null or scholarly work object
  const [editingCompletedWork, setEditingCompletedWork] = useState(null); // null or completed work object
  const [scholarlyTopicInput, setScholarlyTopicInput] = useState(''); // For LLM interaction
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [topicSuggestions, setTopicSuggestions] = useState([]);


  // State for Admin Management (simulated)
  const [simulatedAdmins, setSimulatedAdmins] = useState(SIMULATED_ADMINS); // Start with hardcoded admins
  const [newAdminForm, setNewAdminForm] = useState({ adminId: '', password: '', confirmPassword: '', name: '', role: 'regular-admin' });


  // Initialize Firebase and set up auth listener
  useEffect(() => {
    try {
      const firebaseApp = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(firebaseApp);
      const firebaseAuth = getAuth(firebaseApp);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          // Attempt to sign in with custom token if available
          if (initialAuthToken && !loggedInUser) { // Only try once if not already logged in
            try {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
              console.log("Signed in with custom token.");
              // For this demo, we'll still rely on the simulated login for role management
              // as custom token doesn't carry role info directly without backend.
            } catch (authError) {
              console.error("Error signing in with custom token:", authError);
              // Fallback to anonymous if custom token fails or is not meant for admin login
              await signInAnonymously(firebaseAuth);
              console.log("Signed in anonymously as fallback.");
            }
          }
        } else {
          setUserId(null);
          setLoggedInUser(null);
          // If no user, try to sign in anonymously to get a UID for private collections
          if (!initialAuthToken) { // Only sign in anonymously if no custom token is provided
            try {
              await signInAnonymously(firebaseAuth);
              console.log("Signed in anonymously.");
            } catch (anonError) {
              console.error("Error signing in anonymously:", anonError);
              setError("Failed to initialize authentication.");
            }
          }
        }
        setLoading(false);
      });

      return () => unsubscribe(); // Cleanup auth listener
    } catch (err) {
      console.error("Firebase initialization error:", err);
      setError("Failed to initialize Firebase. Check console for details.");
      setLoading(false);
    }
  }, []); // Empty dependency array means this runs once on mount

  // Fetch data from Firestore
  useEffect(() => {
    if (!db || !userId) return; // Wait for db and userId to be available

    const publicDataPath = `/artifacts/${appId}/public/data`;
    const privateAdminPath = `/artifacts/${appId}/users/${userId}/admins`;

    // Fetch Books
    const unsubscribeBooks = onSnapshot(collection(db, `${publicDataPath}/books`), (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBooks(booksData);
    }, (err) => console.error("Error fetching books:", err));

    // Fetch Publishers
    const unsubscribePublishers = onSnapshot(collection(db, `${publicDataPath}/publishers`), (snapshot) => {
      const publishersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPublishers(publishersData);
    }, (err) => console.error("Error fetching publishers:", err));

    // Fetch Scholarly Works
    const unsubscribeScholarlyWorks = onSnapshot(collection(db, `${publicDataPath}/scholarlyWorks`), (snapshot) => {
      const scholarlyWorksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScholarlyWorks(scholarlyWorksData);
    }, (err) => console.error("Error fetching scholarly works:", err));

    // Fetch Completed Works
    const unsubscribeCompletedWorks = onSnapshot(collection(db, `${publicDataPath}/completedWorks`), (snapshot) => {
      const completedWorksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompletedWorks(completedWorksData);
    }, (err) => console.error("Error fetching completed works:", err));

    // Fetch simulated admins (for persistence if needed, but primarily using hardcoded)
    // This part is more for demonstration of Firestore interaction for admin data.
    // In a real app, admin credentials wouldn't be directly in Firestore public/private data.
    const unsubscribeSimulatedAdmins = onSnapshot(collection(db, privateAdminPath), (snapshot) => {
        const fetchedAdmins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (fetchedAdmins.length > 0) {
            setSimulatedAdmins(fetchedAdmins);
        } else {
            // If no admins in Firestore, initialize with hardcoded ones
            SIMULATED_ADMINS.forEach(async (admin) => {
                const q = query(collection(db, privateAdminPath), where("adminId", "==", admin.adminId));
                const existingDocs = await getDocs(q);
                if (existingDocs.empty) {
                    await addDoc(collection(db, privateAdminPath), admin);
                }
            });
        }
    }, (err) => console.error("Error fetching simulated admins:", err));


    return () => {
      unsubscribeBooks();
      unsubscribePublishers();
      unsubscribeScholarlyWorks();
      unsubscribeCompletedWorks();
      unsubscribeSimulatedAdmins();
    };
  }, [db, userId]); // Re-run if db or userId changes

  // Update bookDescriptionInput when editingBook changes
  useEffect(() => {
    setBookDescriptionInput(editingBook?.description || '');
  }, [editingBook]);

  // Update scholarlyTopicInput when editingScholarlyWork changes
  useEffect(() => {
    setScholarlyTopicInput(editingScholarlyWork?.topic || '');
  }, [editingScholarlyWork]);


  // Helper for showing modal messages
  const showMessageBox = useCallback((message, onConfirm = null) => {
    setModalContent(message);
    setModalAction(() => onConfirm); // Use a function to set the state
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setModalContent('');
    setModalAction(null);
  }, []);

  const handleModalConfirm = useCallback(() => {
    if (modalAction) {
      modalAction();
    }
    closeModal();
  }, [modalAction, closeModal]);

  // --- Authentication Handlers ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const { adminId, password } = e.target.elements;
    const enteredAdminId = adminId.value;
    const enteredPassword = password.value;

    const foundAdmin = simulatedAdmins.find(
      (admin) => admin.adminId === enteredAdminId && admin.password === enteredPassword
    );

    if (foundAdmin) {
      setLoggedInUser(foundAdmin);
      showMessageBox(`Welcome, ${foundAdmin.name || foundAdmin.adminId}!`);
    } else {
      showMessageBox('Invalid Admin ID or Password.');
    }
  };

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      setLoggedInUser(null);
      showMessageBox('Logged out successfully.');
    } catch (err) {
      console.error("Error logging out:", err);
      showMessageBox('Error logging out. Please try again.');
    }
  };

  // --- CRUD Operations for Books ---
  const handleAddOrUpdateBook = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const bookData = Object.fromEntries(formData.entries());
    bookData.description = bookDescriptionInput; // Use the state for description

    // Ensure publisherId is a string
    if (bookData.publisherId === "null" || !bookData.publisherId) {
        bookData.publisherId = null; // Or handle as needed
    }

    try {
      if (editingBook) {
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/books`, editingBook.id), bookData);
        showMessageBox('Book updated successfully!');
        setEditingBook(null);
      } else {
        await addDoc(collection(db, `/artifacts/${appId}/public/data/books`), bookData);
        showMessageBox('Book added successfully!');
      }
      e.target.reset();
      setBookDescriptionInput(''); // Clear description input
    } catch (err) {
      console.error("Error adding/updating book:", err);
      showMessageBox('Error saving book. Please try again.');
    }
  };

  const handleDeleteBook = useCallback((bookId) => {
    showMessageBox('Are you sure you want to delete this book?', async () => {
      try {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/books`, bookId));
        showMessageBox('Book deleted successfully!');
      } catch (err) {
        console.error("Error deleting book:", err);
        showMessageBox('Error deleting book. Please try again.');
      }
    });
  }, [db, appId, showMessageBox]);

  // --- LLM Integration for Book Description ---
  const generateBookDescription = async (action) => {
    if (!bookDescriptionInput.trim()) {
      showMessageBox('Please enter some text in the description field first.');
      return;
    }

    setIsGeneratingBookDescription(true);
    let prompt = '';
    if (action === 'summarize') {
      prompt = `Summarize the following book description concisely:\n\n${bookDescriptionInput}`;
    } else if (action === 'expand') {
      prompt = `Expand on the following brief book description, adding more detail about its themes, potential impact, and target audience. Make it engaging and informative:\n\n${bookDescriptionInput}`;
    }

    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = ""; // Leave as-is for Canvas environment
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const generatedText = result.candidates[0].content.parts[0].text;
        setBookDescriptionInput(generatedText); // Update the input field with generated text
      } else {
        showMessageBox('Failed to generate description. Please try again.');
      }
    } catch (err) {
      console.error("Error calling Gemini API for book description:", err);
      showMessageBox('Error generating description. Please check your network or try again.');
    } finally {
      setIsGeneratingBookDescription(false);
    }
  };


  // --- CRUD Operations for Publishers ---
  const handleAddOrUpdatePublisher = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const publisherData = Object.fromEntries(formData.entries());

    try {
      if (editingPublisher) {
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/publishers`, editingPublisher.id), publisherData);
        showMessageBox('Publisher updated successfully!');
        setEditingPublisher(null);
      } else {
        await addDoc(collection(db, `/artifacts/${appId}/public/data/publishers`), publisherData);
        showMessageBox('Publisher added successfully!');
      }
      e.target.reset();
    } catch (err) {
      console.error("Error adding/updating publisher:", err);
      showMessageBox('Error saving publisher. Please try again.');
    }
  };

  const handleDeletePublisher = useCallback((publisherId) => {
    const isPublisherUsed = books.some(book => book.publisherId === publisherId);
    if (isPublisherUsed) {
      showMessageBox('Cannot delete publisher: It is currently associated with one or more books. Please reassign or delete associated books first.');
      return;
    }

    showMessageBox('Are you sure you want to delete this publisher?', async () => {
      try {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/publishers`, publisherId));
        showMessageBox('Publisher deleted successfully!');
      } catch (err) {
        console.error("Error deleting publisher:", err);
        showMessageBox('Error deleting publisher. Please try again.');
      }
    });
  }, [db, appId, books, showMessageBox]);

  // --- CRUD Operations for Scholarly Works ---
  const handleAddOrUpdateScholarlyWork = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const workData = Object.fromEntries(formData.entries());
    workData.topic = scholarlyTopicInput; // Use the state for topic

    try {
      if (editingScholarlyWork) {
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/scholarlyWorks`, editingScholarlyWork.id), workData);
        showMessageBox('Scholarly work updated successfully!');
        setEditingScholarlyWork(null);
      } else {
        await addDoc(collection(db, `/artifacts/${appId}/public/data/scholarlyWorks`), workData);
        showMessageBox('Scholarly work added successfully!');
      }
      e.target.reset();
      setScholarlyTopicInput(''); // Clear topic input
      setTopicSuggestions([]); // Clear suggestions
    } catch (err) {
      console.error("Error adding/updating scholarly work:", err);
      showMessageBox('Error saving scholarly work. Please try again.');
    }
  };

  const handleDeleteScholarlyWork = useCallback((workId) => {
    showMessageBox('Are you sure you want to delete this scholarly work?', async () => {
      try {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/scholarlyWorks`, workId));
        showMessageBox('Scholarly work deleted successfully!');
      } catch (err) {
        console.error("Error deleting scholarly work:", err);
        showMessageBox('Error deleting scholarly work. Please try again.');
      }
    });
  }, [db, appId, showMessageBox]);

  // --- LLM Integration for Scholarly Work Topic Suggestion ---
  const generateTopicSuggestions = async () => {
    const scholarName = document.getElementById('scholarName').value || '';
    const universityName = document.getElementById('universityName').value || '';

    setIsGeneratingTopics(true);
    let prompt = `Suggest 3-5 unique and compelling research topics related to Hussain Ul Haque's works.`;
    if (scholarName) {
      prompt += ` Consider the scholar's name '${scholarName}'.`;
    }
    if (universityName) {
      prompt += ` The scholar is from '${universityName}'.`;
    }
    prompt += ` Provide the topics as a numbered list, each on a new line.`;

    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiKey = ""; // Leave as-is for Canvas environment
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const generatedText = result.candidates[0].content.parts[0].text;
        const suggestions = generatedText.split('\n').filter(line => line.trim() !== '').map(line => line.replace(/^\d+\.\s*/, ''));
        setTopicSuggestions(suggestions);
      } else {
        showMessageBox('Failed to generate topic suggestions. Please try again.');
      }
    } catch (err) {
      console.error("Error calling Gemini API for topic suggestions:", err);
      showMessageBox('Error generating topic suggestions. Please check your network or try again.');
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  // --- CRUD Operations for Completed Works ---
  const handleAddOrUpdateCompletedWork = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const workData = Object.fromEntries(formData.entries());

    try {
      if (editingCompletedWork) {
        await updateDoc(doc(db, `/artifacts/${appId}/public/data/completedWorks`, editingCompletedWork.id), workData);
        showMessageBox('Completed work updated successfully!');
        setEditingCompletedWork(null);
      } else {
        await addDoc(collection(db, `/artifacts/${appId}/public/data/completedWorks`), workData);
        showMessageBox('Completed work added successfully!');
      }
      e.target.reset();
    } catch (err) {
      console.error("Error adding/updating completed work:", err);
      showMessageBox('Error saving completed work. Please try again.');
    }
  };

  const handleDeleteCompletedWork = useCallback((workId) => {
    showMessageBox('Are you sure you want to delete this completed work?', async () => {
      try {
        await deleteDoc(doc(db, `/artifacts/${appId}/public/data/completedWorks`, workId));
        showMessageBox('Completed work deleted successfully!');
      } catch (err) {
        console.error("Error deleting completed work:", err);
        showMessageBox('Error deleting completed work. Please try again.');
      }
    });
  }, [db, appId, showMessageBox]);

  // --- Admin Management (Simulated) ---
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const { adminId, password, confirmPassword, name, role } = newAdminForm;

    if (!adminId || !password || !confirmPassword || !name || !role) {
      showMessageBox('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      showMessageBox('Passwords do not match.');
      return;
    }
    if (simulatedAdmins.some(admin => admin.adminId === adminId)) {
      showMessageBox('Admin ID already exists.');
      return;
    }

    try {
      const newAdmin = { adminId, password, name, role };
      // Add to simulated admins state
      setSimulatedAdmins(prev => [...prev, newAdmin]);
      // Also attempt to persist in Firestore (private collection)
      if (db && userId) {
        await addDoc(collection(db, `/artifacts/${appId}/users/${userId}/admins`), newAdmin);
      }
      showMessageBox('New admin added successfully!');
      setNewAdminForm({ adminId: '', password: '', confirmPassword: '', name: '', role: 'regular-admin' });
    } catch (err) {
      console.error("Error adding simulated admin:", err);
      showMessageBox('Error adding new admin. Please try again.');
    }
  };

  const handleDeleteAdmin = useCallback((targetAdminId) => {
    if (loggedInUser.adminId === targetAdminId) {
      showMessageBox('You cannot delete your own admin account.');
      return;
    }
    if (simulatedAdmins.filter(admin => admin.role === 'super-admin').length === 1 &&
        simulatedAdmins.find(admin => admin.adminId === targetAdminId)?.role === 'super-admin') {
      showMessageBox('Cannot delete the last super-admin account.');
      return;
    }

    showMessageBox(`Are you sure you want to delete admin "${targetAdminId}"?`, async () => {
      try {
        setSimulatedAdmins(prev => prev.filter(admin => admin.adminId !== targetAdminId));
        // Attempt to delete from Firestore
        if (db && userId) {
          const q = query(collection(db, `/artifacts/${appId}/users/${userId}/admins`), where("adminId", "==", targetAdminId));
          const snapshot = await getDocs(q);
          snapshot.forEach(async (docToDelete) => {
            await deleteDoc(doc(db, `/artifacts/${appId}/users/${userId}/admins`, docToDelete.id));
          });
        }
        showMessageBox('Admin deleted successfully!');
      } catch (err) {
        console.error("Error deleting simulated admin:", err);
        showMessageBox('Error deleting admin. Please try again.');
      }
    });
  }, [loggedInUser, simulatedAdmins, db, userId, showMessageBox]);

  const handleResetAdminPassword = useCallback((targetAdminId) => {
    showMessageBox(`Are you sure you want to reset password for admin "${targetAdminId}"? (This action is simulated and will set a default password like 'newpass')`, async () => {
      try {
        setSimulatedAdmins(prev => prev.map(admin =>
          admin.adminId === targetAdminId ? { ...admin, password: 'newpass' } : admin
        ));
        // Attempt to update in Firestore
        if (db && userId) {
            const q = query(collection(db, `/artifacts/${appId}/users/${userId}/admins`), where("adminId", "==", targetAdminId));
            const snapshot = await getDocs(q);
            snapshot.forEach(async (docToUpdate) => {
                await updateDoc(doc(db, `/artifacts/${appId}/users/${userId}/admins`, docToUpdate.id), { password: 'newpass' });
            });
        }
        showMessageBox(`Password for ${targetAdminId} reset to 'newpass' (simulated).`);
      } catch (err) {
        console.error("Error resetting simulated admin password:", err);
        showMessageBox('Error resetting admin password. Please try again.');
      }
    });
  }, [simulatedAdmins, db, userId, showMessageBox]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
        <div className="text-xl text-gray-700">Loading Dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 font-inter">
        <div className="text-xl text-red-700">Error: {error}</div>
      </div>
    );
  }

  // --- Login Screen ---
  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 font-inter">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Admin Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="adminId" className="block text-sm font-medium text-gray-700 mb-1">Admin ID</label>
              <input
                type="text"
                id="adminId"
                name="adminId"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
            >
              Login
            </button>
          </form>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center">
              <p className="text-lg font-semibold mb-4">{modalContent}</p>
              <button
                onClick={closeModal}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition duration-200"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Main Dashboard Layout ---
  return (
    <div className="flex min-h-screen bg-gray-100 font-inter">
      {/* Message Box Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center">
            <p className="text-lg font-semibold mb-4">{modalContent}</p>
            <div className="flex justify-center space-x-4">
              {modalAction && (
                <button
                  onClick={handleModalConfirm}
                  className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition duration-200"
                >
                  Confirm
                </button>
              )}
              <button
                onClick={closeModal}
                className={`${modalAction ? 'bg-gray-400 hover:bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-2 rounded-md transition duration-200`}
              >
                {modalAction ? 'Cancel' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gray-800 text-white p-6 flex flex-col rounded-r-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-8 text-center text-blue-300">Dashboard</h1>
        <nav className="flex-grow">
          <ul>
            <li className="mb-4">
              <button
                onClick={() => setActiveTab('books')}
                className={`w-full text-left px-4 py-2 rounded-lg transition duration-200 ${
                  activeTab === 'books' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-700'
                }`}
              >
                Books
              </button>
            </li>
            <li className="mb-4">
              <button
                onClick={() => setActiveTab('research')}
                className={`w-full text-left px-4 py-2 rounded-lg transition duration-200 ${
                  activeTab === 'research' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-700'
                }`}
              >
                Research
              </button>
            </li>
            {loggedInUser?.role === 'super-admin' && (
              <li className="mb-4">
                <button
                  onClick={() => setActiveTab('admin-management')}
                  className={`w-full text-left px-4 py-2 rounded-lg transition duration-200 ${
                    activeTab === 'admin-management' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-700'
                  }`}
                >
                  Admin Management
                </button>
              </li>
            )}
          </ul>
        </nav>
        <div className="mt-auto pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 mb-2">Logged in as: <span className="font-semibold">{loggedInUser?.name || loggedInUser?.adminId}</span> ({loggedInUser?.role})</p>
          <p className="text-sm text-gray-400 mb-4">Your User ID: <span className="font-semibold break-all">{userId}</span></p>
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition duration-200 shadow-md"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-8">
        <div className="bg-white p-8 rounded-xl shadow-lg min-h-[calc(100vh-64px)]">
          {activeTab === 'books' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Books Management</h2>

              {/* Add/Edit Book Form */}
              <div className="mb-8 p-6 bg-blue-50 rounded-xl shadow-inner">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4">{editingBook ? 'Edit Book' : 'Add New Book'}</h3>
                <form onSubmit={handleAddOrUpdateBook} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      id="title"
                      name="title"
                      defaultValue={editingBook?.title || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                    <input
                      type="text"
                      id="author"
                      name="author"
                      defaultValue={editingBook?.author || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="publisherId" className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                    <select
                      id="publisherId"
                      name="publisherId"
                      defaultValue={editingBook?.publisherId || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select a Publisher</option>
                      {publishers.map(publisher => (
                        <option key={publisher.id} value={publisher.id}>{publisher.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="publicationYear" className="block text-sm font-medium text-gray-700 mb-1">Publication Year</label>
                    <input
                      type="number"
                      id="publicationYear"
                      name="publicationYear"
                      defaultValue={editingBook?.publicationYear || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={bookDescriptionInput}
                      onChange={(e) => setBookDescriptionInput(e.target.value)}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    ></textarea>
                    <div className="mt-2 flex space-x-2">
                      <button
                        type="button"
                        onClick={() => generateBookDescription('summarize')}
                        disabled={isGeneratingBookDescription}
                        className="bg-purple-500 text-white py-1 px-3 rounded-md hover:bg-purple-600 transition duration-200 shadow-sm text-sm flex items-center justify-center"
                      >
                        {isGeneratingBookDescription ? 'Summarizing...' : '✨ Summarize'}
                      </button>
                      <button
                        type="button"
                        onClick={() => generateBookDescription('expand')}
                        disabled={isGeneratingBookDescription}
                        className="bg-indigo-500 text-white py-1 px-3 rounded-md hover:bg-indigo-600 transition duration-200 shadow-sm text-sm flex items-center justify-center"
                      >
                        {isGeneratingBookDescription ? 'Expanding...' : '✨ Expand'}
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex space-x-4">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 shadow-md"
                    >
                      {editingBook ? 'Update Book' : 'Add Book'}
                    </button>
                    {editingBook && (
                      <button
                        type="button"
                        onClick={() => setEditingBook(null)}
                        className="bg-gray-400 text-white py-2 px-4 rounded-md hover:bg-gray-500 transition duration-200 shadow-md"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Books List */}
              <h3 className="text-2xl font-semibold text-gray-700 mb-4">All Books</h3>
              <div className="overflow-x-auto rounded-xl shadow-md">
                <table className="min-w-full bg-white border border-gray-200 rounded-xl">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">S. No.</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Title</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Author</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Publisher</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Year</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-4 px-4 text-center text-gray-500">No books added yet.</td>
                      </tr>
                    ) : (
                      books.map((book, index) => (
                        <tr key={book.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-800">{index + 1}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{book.title}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{book.author}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {publishers.find(p => p.id === book.publisherId)?.name || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">{book.publicationYear}</td>
                          <td className="py-3 px-4 text-sm">
                            <button
                              onClick={() => setEditingBook(book)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteBook(book.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Publisher Management */}
              <div className="mt-12 p-6 bg-green-50 rounded-xl shadow-inner">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4">{editingPublisher ? 'Edit Publisher' : 'Add New Publisher'}</h3>
                <form onSubmit={handleAddOrUpdatePublisher} className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-grow">
                    <label htmlFor="publisherName" className="block text-sm font-medium text-gray-700 mb-1">Publisher Name</label>
                    <input
                      type="text"
                      id="publisherName"
                      name="name"
                      defaultValue={editingPublisher?.name || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition duration-200 shadow-md"
                    >
                      {editingPublisher ? 'Update Publisher' : 'Add Publisher'}
                    </button>
                    {editingPublisher && (
                      <button
                        type="button"
                        onClick={() => setEditingPublisher(null)}
                        className="bg-gray-400 text-white py-2 px-4 rounded-md hover:bg-gray-500 transition duration-200 shadow-md"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <h3 className="text-2xl font-semibold text-gray-700 mt-8 mb-4">All Publishers</h3>
              <div className="overflow-x-auto rounded-xl shadow-md">
                <table className="min-w-full bg-white border border-gray-200 rounded-xl">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">S. No.</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Publisher Name</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishers.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="py-4 px-4 text-center text-gray-500">No publishers added yet.</td>
                      </tr>
                    ) : (
                      publishers.map((publisher, index) => (
                        <tr key={publisher.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-800">{index + 1}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{publisher.name}</td>
                          <td className="py-3 px-4 text-sm">
                            <button
                              onClick={() => setEditingPublisher(publisher)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePublisher(publisher.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'research' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Research Management</h2>

              {/* Add/Edit Scholarly Work Form */}
              <div className="mb-8 p-6 bg-purple-50 rounded-xl shadow-inner">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4">{editingScholarlyWork ? 'Edit Scholarly Work' : 'Add New Scholarly Work'}</h3>
                <form onSubmit={handleAddOrUpdateScholarlyWork} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="scholarName" className="block text-sm font-medium text-gray-700 mb-1">Name of Scholar</label>
                    <input
                      type="text"
                      id="scholarName"
                      name="scholarName"
                      defaultValue={editingScholarlyWork?.scholarName || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="universityName" className="block text-sm font-medium text-gray-700 mb-1">University Name</label>
                    <input
                      type="text"
                      id="universityName"
                      name="universityName"
                      defaultValue={editingScholarlyWork?.universityName || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="degreeYear" className="block text-sm font-medium text-gray-700 mb-1">Degree - Year</label>
                    <input
                      type="text"
                      id="degreeYear"
                      name="degreeYear"
                      placeholder="e.g., PhD - 2023"
                      defaultValue={editingScholarlyWork?.degreeYear || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                    <input
                      type="text"
                      id="topic"
                      name="topic"
                      value={scholarlyTopicInput}
                      onChange={(e) => setScholarlyTopicInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateTopicSuggestions}
                      disabled={isGeneratingTopics}
                      className="mt-2 bg-pink-500 text-white py-1 px-3 rounded-md hover:bg-pink-600 transition duration-200 shadow-sm text-sm flex items-center justify-center"
                    >
                      {isGeneratingTopics ? 'Generating...' : '✨ Suggest Topics'}
                    </button>
                    {topicSuggestions.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p className="font-semibold mb-1">Suggestions:</p>
                        <ul className="list-disc list-inside">
                          {topicSuggestions.map((suggestion, idx) => (
                            <li key={idx} className="mb-1">
                              {suggestion}
                              <button
                                type="button"
                                onClick={() => setScholarlyTopicInput(suggestion)}
                                className="ml-2 text-blue-500 hover:underline"
                              >
                                Use
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2 flex space-x-4">
                    <button
                      type="submit"
                      className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition duration-200 shadow-md"
                    >
                      {editingScholarlyWork ? 'Update Scholarly Work' : 'Add Scholarly Work'}
                    </button>
                    {editingScholarlyWork && (
                      <button
                        type="button"
                        onClick={() => setEditingScholarlyWork(null)}
                        className="bg-gray-400 text-white py-2 px-4 rounded-md hover:bg-gray-500 transition duration-200 shadow-md"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Scholarly Works List */}
              <h3 className="text-2xl font-semibold text-gray-700 mb-4">Scholarly Works on Hussain Ul Haque</h3>
              <div className="overflow-x-auto rounded-xl shadow-md">
                <table className="min-w-full bg-white border border-gray-200 rounded-xl">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">S. No.</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Name of Scholar</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">University Name</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Degree - Year</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Topic</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scholarlyWorks.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-4 px-4 text-center text-gray-500">No scholarly works added yet.</td>
                      </tr>
                    ) : (
                      scholarlyWorks.map((work, index) => (
                        <tr key={work.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-800">{index + 1}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{work.scholarName}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{work.universityName}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{work.degreeYear}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{work.topic}</td>
                          <td className="py-3 px-4 text-sm">
                            <button
                              onClick={() => setEditingScholarlyWork(work)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteScholarlyWork(work.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add/Edit Completed Work Form */}
              <div className="mt-12 mb-8 p-6 bg-orange-50 rounded-xl shadow-inner">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4">{editingCompletedWork ? 'Edit Completed Work' : 'Add New Completed Work'}</h3>
                <form onSubmit={handleAddOrUpdateCompletedWork} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="completedWorkTitle" className="block text-sm font-medium text-gray-700 mb-1">Project/Work Title</label>
                    <input
                      type="text"
                      id="completedWorkTitle"
                      name="title"
                      defaultValue={editingCompletedWork?.title || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="yearOfCompletion" className="block text-sm font-medium text-gray-700 mb-1">Year of Completion</label>
                    <input
                      type="number"
                      id="yearOfCompletion"
                      name="yearOfCompletion"
                      defaultValue={editingCompletedWork?.yearOfCompletion || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="completedWorkDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      id="completedWorkDescription"
                      name="description"
                      defaultValue={editingCompletedWork?.description || ''}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    ></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="associatedInstitution" className="block text-sm font-medium text-gray-700 mb-1">Associated Institution/Collaboration (Optional)</label>
                    <input
                      type="text"
                      id="associatedInstitution"
                      name="associatedInstitution"
                      defaultValue={editingCompletedWork?.associatedInstitution || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2 flex space-x-4">
                    <button
                      type="submit"
                      className="bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition duration-200 shadow-md"
                    >
                      {editingCompletedWork ? 'Update Completed Work' : 'Add Completed Work'}
                    </button>
                    {editingCompletedWork && (
                      <button
                        type="button"
                        onClick={() => setEditingCompletedWork(null)}
                        className="bg-gray-400 text-white py-2 px-4 rounded-md hover:bg-gray-500 transition duration-200 shadow-md"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Completed Works List */}
              <h3 className="text-2xl font-semibold text-gray-700 mt-8 mb-4">Completed Works by Hussain Ul Haque</h3>
              <div className="overflow-x-auto rounded-xl shadow-md">
                <table className="min-w-full bg-white border border-gray-200 rounded-xl">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">S. No.</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Project/Work Title</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Year</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedWorks.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="py-4 px-4 text-center text-gray-500">No completed works added yet.</td>
                      </tr>
                    ) : (
                      completedWorks.map((work, index) => (
                        <tr key={work.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-800">{index + 1}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{work.title}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{work.yearOfCompletion}</td>
                          <td className="py-3 px-4 text-sm">
                            <button
                              onClick={() => setEditingCompletedWork(work)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCompletedWork(work.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'admin-management' && loggedInUser?.role === 'super-admin' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6">Admin Management</h2>

              {/* Add New Admin Form */}
              <div className="mb-8 p-6 bg-red-50 rounded-xl shadow-inner">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4">Add New Administrator</h3>
                <form onSubmit={handleAddAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="newAdminId" className="block text-sm font-medium text-gray-700 mb-1">Admin ID</label>
                    <input
                      type="text"
                      id="newAdminId"
                      name="adminId"
                      value={newAdminForm.adminId}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, adminId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="newAdminName" className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
                    <input
                      type="text"
                      id="newAdminName"
                      name="name"
                      value={newAdminForm.name}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="newAdminPassword" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      id="newAdminPassword"
                      name="password"
                      value={newAdminForm.password}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmNewAdminPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <input
                      type="password"
                      id="confirmNewAdminPassword"
                      name="confirmPassword"
                      value={newAdminForm.confirmPassword}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="newAdminRole" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      id="newAdminRole"
                      name="role"
                      value={newAdminForm.role}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                      required
                    >
                      <option value="regular-admin">Regular Admin</option>
                      <option value="super-admin">Super Admin</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition duration-200 shadow-md"
                    >
                      Add Admin
                    </button>
                  </div>
                </form>
              </div>

              {/* Admin List */}
              <h3 className="text-2xl font-semibold text-gray-700 mb-4">Existing Administrators</h3>
              <div className="overflow-x-auto rounded-xl shadow-md">
                <table className="min-w-full bg-white border border-gray-200 rounded-xl">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">S. No.</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Admin ID</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Role</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulatedAdmins.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-4 px-4 text-center text-gray-500">No administrators found.</td>
                      </tr>
                    ) : (
                      simulatedAdmins.map((admin, index) => (
                        <tr key={admin.adminId} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-800">{index + 1}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{admin.adminId}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{admin.name}</td>
                          <td className="py-3 px-4 text-sm text-gray-800 capitalize">{admin.role}</td>
                          <td className="py-3 px-4 text-sm">
                            <button
                              onClick={() => handleResetAdminPassword(admin.adminId)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                              disabled={admin.adminId === loggedInUser.adminId}
                            >
                              Reset Password
                            </button>
                            <button
                              onClick={() => handleDeleteAdmin(admin.adminId)}
                              className="text-red-600 hover:text-red-800"
                              disabled={admin.adminId === loggedInUser.adminId || (admin.role === 'super-admin' && simulatedAdmins.filter(a => a.role === 'super-admin').length === 1)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'admin-management' && loggedInUser?.role !== 'super-admin' && (
            <div className="text-center text-red-600 text-xl font-semibold mt-12">
              Access Denied: Only Super Admins can view this section.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
