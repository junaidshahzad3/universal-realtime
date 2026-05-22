# Example: Collaborative Document Editing

This example demonstrates how to implement an optimistic editor update utilizing `useOptimisticUpdate` to achieve a zero-latency interface. If the backend fails or rejects the update, the UI automatically rolls back to the previous stable state and triggers an error callback.

```tsx
import React, { useState } from 'react';
import { useOptimisticUpdate } from 'use-realtime';

interface DocumentContent {
  text: string;
  updatedAt: string;
  version: number;
}

// Simulating API save call
const saveDocument = async (text: string): Promise<DocumentContent> => {
  const response = await fetch('/api/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  
  if (!response.ok) {
    throw new Error('Conflict or network error during document save');
  }

  return response.json();
};

export const DocumentEditor = ({ initialDoc }: { initialDoc: DocumentContent }) => {
  const [editorText, setEditorText] = useState(initialDoc.text);
  
  const { data: doc, update, isPending } = useOptimisticUpdate<DocumentContent>(
    initialDoc,
    {
      onSuccess: (savedDoc) => {
        console.log(`Document version ${savedDoc.version} saved successfully!`);
      },
      onError: (err, rollback) => {
        // Handle rejection or conflict (e.g. notify user, restore local state)
        alert('Save failed! Reverting editor state to the last saved content.');
        setEditorText(doc.text); // Sync editor back to previous state
      }
    }
  );

  const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = e.target.value;
    setEditorText(nextText);

    // Prepare the optimistic document state
    const optimisticDoc: DocumentContent = {
      ...doc,
      text: nextText,
      version: doc.version + 1,
      updatedAt: new Date().toISOString()
    };

    // Perform the optimistic update
    await update(optimisticDoc, () => saveDocument(nextText));
  };

  return (
    <div className="editor-container">
      <header className="editor-header">
        <h3>Collaborative Document Editor</h3>
        <span className="status-indicator">
          {isPending ? 'Saving changes...' : 'All changes saved to cloud'}
        </span>
      </header>

      <textarea
        value={editorText}
        onChange={handleTextChange}
        placeholder="Start writing..."
        className="editor-textarea"
      />

      <footer className="editor-footer">
        <span>Last saved: {new Date(doc.updatedAt).toLocaleTimeString()}</span>
        <span>Version: v{doc.version}</span>
      </footer>
    </div>
  );
};
```
