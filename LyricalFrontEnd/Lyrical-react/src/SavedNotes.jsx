import React, { useEffect, useState } from 'react';

const SavedNotes = ({ onInsertSequence, updateSavedNotes }) => {
  const [notes, setNotes] = useState([]);
  const [error, setError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const fetchSavedNotes = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/saved_notes`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,  // Assuming JWT token is stored in localStorage
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch saved notes');
        }

        const data = await response.json();
        console.log('Fetched notes:', data);  // Log the fetched data
        setNotes(data.notes);
      } catch (error) {
        setError(error.message);
      }
    };

    fetchSavedNotes();
  }, [API_BASE_URL, updateSavedNotes]); // Include `updateSavedNotes` as a dependency to re-fetch notes

  const handleDelete = async (sequenceId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/delete_note`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sequenceId }),  // Send the SequenceId to be deleted
      });

      if (!response.ok) {
        throw new Error('Failed to delete the note');
      }

      // Remove the deleted note from the state
      setNotes(notes.filter(note => note.SequenceId !== sequenceId));
      updateSavedNotes(); // Refresh the saved notes list after deletion
    } catch (error) {
      setError(error.message);
    }
  };

  const handleInsert = (note) => {
    const metadata = JSON.parse(note.Metadata);
    console.log('Inserting note:', metadata.notes);  
    onInsertSequence(metadata.notes);  
  };

  return (
    <div className="saved-notes-container">
      <h2>Saved Notes</h2>
      {error && <p className="error">{error}</p>}
      <ul>
        {notes.length > 0 ? (
          notes.map((note, index) => (
            <li key={index}>
              <p>Sequence ID: {note.SequenceId}</p>
              <button onClick={() => handleDelete(note.SequenceId)}>Delete</button>
              <button onClick={() => handleInsert(note)}>Insert into Piano Roll</button>
            </li>
          ))
        ) : (
          <p>No saved notes available.</p>
        )}
      </ul>
    </div>
  );
};

export default SavedNotes;