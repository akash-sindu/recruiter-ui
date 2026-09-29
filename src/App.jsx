import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'; 
import { Send, Upload, Sun, Moon, Menu, X, UserCheck, FileText } from 'lucide-react';

const API_BASE = 'http://localhost:50000/api';

const getOrCreateSessionId = () => {
  const storageKey = 'recruiter-assistant-session-id';
  const existingSessionId = window.sessionStorage.getItem(storageKey);
  if (existingSessionId) return existingSessionId;

  const sessionId = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(storageKey, sessionId);
  return sessionId;
};

export default function App() {
  const [sessionId] = useState(getOrCreateSessionId);

  // Theme & Layout State
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Job Description State
  const [jdText, setJdText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [parsedJd, setParsedJd] = useState(null);
  const [fitAnalysis, setFitAnalysis] = useState(null);
  const [isProcessingJd, setIsProcessingJd] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am Aakash's executive career assistant. Upload a PDF/DOCX or paste a Job Description on the left, or ask me any question directly about his experience, technical fit, or qualifications."
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef(null);
  const chatTextareaRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Toggle Theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Fix Issue 1: Paste Text clears uploaded file reference
  const handleTextChange = (e) => {
    setJdText(e.target.value);
    if (e.target.value && uploadedFileName) {
      setUploadedFileName(''); // Clear retain file badge
    }
  };

  // Fix Issue 2: File Upload clears pasted text state
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset pasted text field instantly
    setJdText('');
    setUploadedFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);

    setIsProcessingJd(true);
    try {
      const res = await fetch(`${API_BASE}/upload-jd-file`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setParsedJd(data.parsed_jd);
        setFitAnalysis(data.fit_analysis);
      } else {
        alert(data.error || 'Failed to process file');
        setUploadedFileName('');
      }
    } catch (err) {
      alert('Error uploading file');
      setUploadedFileName('');
    } finally {
      setIsProcessingJd(false);
    }
  };

  // Submit Text JD
  const handleTextUpload = async () => {
    if (!jdText.trim()) return;
    setIsProcessingJd(true);
    try {
      const res = await fetch(`${API_BASE}/upload-jd-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jdText, session_id: sessionId })
      });
      const data = await res.json();
      if (res.ok) {
        setParsedJd(data.parsed_jd);
        setFitAnalysis(data.fit_analysis);
      } else {
        alert(data.error || 'Failed to process Job Description');
      }
    } catch (err) {
      alert('Error connecting to backend');
    } finally {
      setIsProcessingJd(false);
    }
  };

  // Fix Issue 3: Shift+Enter creates new line, Enter sends message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Stream Message Handler
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userText = inputMessage;
    setInputMessage('');

    // Reset chat textarea height
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = 'auto';
    }

    const updatedHistory = [...messages, { role: 'user', content: userText }];
    setMessages(updatedHistory);
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: userText,
          history: updatedHistory.slice(1)
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawData = line.replace('data: ', '').trim();
            if (rawData === '[DONE]') break;

            try {
              const parsed = JSON.parse(rawData);
              if (parsed.content) {
                assistantText += parsed.content;
                setMessages((prev) => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = assistantText;
                  return newMsgs;
                });
              }
            } catch (e) {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '❌ Error connecting to stream.' }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <UserCheck color="var(--accent-color)" size={22} />
            <span>Recruiter Assistant</span>
          </div>
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>

        {/* Upload Card */}
        <div className="section-card">
          <h3>Target Job Description</h3>

          {uploadedFileName ? (
            <div className="active-file-badge">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} /> {uploadedFileName}
              </span>
              <button className="clear-btn" onClick={() => setUploadedFileName('')}>×</button>
            </div>
          ) : (
            <label className="file-label">
              <Upload size={18} style={{ marginBottom: 4 }} />
              <div>Upload PDF / DOCX</div>
              <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.docx,.txt" />
            </label>
          )}

          <textarea
            className="jd-textarea"
            placeholder="Or paste job description text here..."
            value={jdText}
            onChange={handleTextChange}
          />

          <button className="btn-primary" onClick={handleTextUpload} disabled={isProcessingJd || (!jdText && !uploadedFileName)}>
            {isProcessingJd ? 'Analyzing JD...' : 'Analyze Job Description'}
          </button>
        </div>

        {/* Fit Assessment Badge */}
        {fitAnalysis && (
          <div className="section-card">
            <h3>Fit Assessment</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="score-badge">
                {fitAnalysis.match_score == null ? 'N/A' : `${fitAnalysis.match_score}%`}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>
                  {fitAnalysis.match_score == null ? 'Insufficient profile evidence for a fit score' : 'Evidenced fit'}
                </div>
                <div>{fitAnalysis.verdict_summary}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: '0.85rem' }}>
              <span>Profile evidence coverage</span>
              <strong>{fitAnalysis.evidence_coverage ?? 'N/A'}%</strong>
            </div>

            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Strong Matches:</strong>
              <div className="tag-list" style={{ marginTop: 4 }}>
                {fitAnalysis.strong_matches?.map((skill, idx) => (
                  <span className="tag" key={idx}>{skill}</span>
                ))}
              </div>
            </div>

            {fitAnalysis.potential_gaps?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Partial Evidence:</strong>
                <div className="tag-list" style={{ marginTop: 4 }}>
                  {fitAnalysis.potential_gaps.map((criterion, idx) => (
                    <span className="tag" key={idx}>{criterion}</span>
                  ))}
                </div>
              </div>
            )}

            {fitAnalysis.not_documented?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>Not Documented in Profile:</strong>
                <div className="tag-list" style={{ marginTop: 4 }}>
                  {fitAnalysis.not_documented.map((criterion, idx) => (
                    <span className="tag" key={idx}>{criterion}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close recruiter assistant menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* CHAT AREA */}
      <div className="chat-container">
        <div className="chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Candidate Evaluation Assistant</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Real-Time Candidate Assessment
              </p>
            </div>
          </div>
        </div>

        {/* Messages Feed with Markdown Fix */}
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {msg.content || (isStreaming && index === messages.length - 1 ? '...' : '')}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Textarea with Shift+Enter Support */}
        <div className="chat-input-area">
          <textarea
            ref={chatTextareaRef}
            className="chat-textarea"
            rows={1}
            placeholder="Type a question..."
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <button
            className="btn-primary"
            onClick={handleSendMessage}
            disabled={isStreaming || !inputMessage.trim()}
            style={{ padding: '12px 18px' }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}