import React, { useState, useRef, useEffect } from 'react';
import chatAPI from '../../services/chatAPI';
import ReactMarkdown from 'react-markdown';
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, BugAntIcon, ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

const INITIAL_GREETING = "Hi! I'm your PFIMS budget assistant. How can I help today?";

const Assistant = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: INITIAL_GREETING }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState(false);
  const [lite, setLite] = useState(false);
  const [lastMeta, setLastMeta] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [lastUserText, setLastUserText] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const chatRef = useRef(null);

  useEffect(() => {
    // Auto-scroll chat to bottom on new messages or when loading state changes
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Load sessions on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingSessions(true);
      try {
        const res = await chatAPI.listSessions();
        const list = res.data?.data || [];
        if (mounted) setSessions(list);
      } catch (e) {
        // silent; toasts handled globally
      } finally {
        if (mounted) setLoadingSessions(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await chatAPI.listSessions();
      const list = res.data?.data || [];
      setSessions(list);
    } catch (e) {
      // handled globally
    } finally {
      setLoadingSessions(false);
    }
  };

  const selectSession = async (id) => {
    try {
      const res = await chatAPI.getSession(id);
      const data = res.data?.data;
      setSelectedSessionId(id);
      const msgs = Array.isArray(data?.messages) ? data.messages : [];
      if (msgs.length === 0) {
        setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
      } else {
        setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
      }
      setLastMeta(null);
      setLastError(null);
      setRenamingId(null);
    } catch (e) {}
  };

  const createSession = async () => {
    try {
      const res = await chatAPI.createSession();
      const id = res.data?.data?.id;
      if (id) {
        await loadSessions();
        await selectSession(id);
      }
    } catch (e) {}
  };

  const startRenaming = (id) => {
    const s = sessions.find(x => x.id === id);
    setRenamingId(id);
    setRenameText(s?.title || '');
  };

  const applyRename = async () => {
    if (!renamingId) return;
    try {
      await chatAPI.renameSession(renamingId, renameText.trim() || 'New Chat');
      setSessions(prev => prev.map(s => s.id === renamingId ? { ...s, title: renameText.trim() || 'New Chat' } : s));
      setRenamingId(null);
      setRenameText('');
    } catch (e) {}
  };

  const deleteSession = async (id) => {
    try {
      await chatAPI.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSessionId === id) {
        setSelectedSessionId(null);
        setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
        setLastMeta(null);
        setLastError(null);
      }
    } catch (e) {}
  };

  const doSend = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const newMessages = [...messages, { role: 'user', content: trimmed }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setLastError(null);

    try {
      // Build history from existing messages only (exclude the new user message we just appended)
      const history = messages
        .filter((m, idx) => {
          if (m.role === 'assistant') {
            const isInitial = idx === 0 && m.content.trim() === INITIAL_GREETING;
            const isDebugLine = m.content.trim().startsWith('Debug:');
            const isErrorPlaceholder = m.content.trim() === 'I hit an error. Please try again.';
            return !(isInitial || isDebugLine || isErrorPlaceholder);
          }
          return true;
        })
        .map(m => ({ role: m.role, content: m.content }));

      const res = await chatAPI.sendMessage({ sessionId: selectedSessionId, message: trimmed, history, includeContext: !lite, debug, lite });
      const reply = res.data?.data?.reply || 'Sorry, I was unable to generate a response.';
      const meta = res.data?.data?.meta;
      const newSessionId = res.data?.data?.sessionId;
      if (!selectedSessionId && newSessionId) {
        setSelectedSessionId(newSessionId);
        loadSessions();
      }
      if (meta) setLastMeta(meta);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || err?.message || 'Unknown error';
      const serverDetails = err?.response?.data?.details;
      const details = serverDetails || (typeof err === 'object' ? JSON.stringify({ name: err?.name, message: err?.message, stack: err?.stack }, null, 2) : String(err));
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const code = err?.code;
      setLastError({ status, message, details, url, baseURL, code });
      setMessages(prev => [...prev, { role: 'assistant', content: 'I hit an error. Please try again.' }]);
      if (debug) {
        const dbgText = `Debug: ${message}${details ? ` | Details: ${String(details).slice(0, 500)}` : ''}${status ? ` | Status: ${status}` : ''}${code ? ` | Code: ${code}` : ''}${baseURL ? ` | BaseURL: ${baseURL}` : ''}${url ? ` | URL: ${url}` : ''}`;
        setMessages(prev => [...prev, { role: 'assistant', content: dbgText }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setLastUserText(text);
    await doSend(text);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-secondary-200">
      <div className="px-6 py-4 border-b border-secondary-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-secondary-900">PFIMS Assistant</h2>
          <p className="text-sm text-secondary-600">Ask budgeting questions, get spending insights, and tips.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={createSession}
              className="text-xs text-primary-600 hover:text-primary-700 bg-primary-50 border border-primary-200 px-2 py-1 rounded-md inline-flex items-center"
              title="New Chat"
            >
              <PlusCircleIcon className="h-4 w-4 mr-1" /> New
            </button>
            <select
              className="text-sm border border-secondary-300 rounded-md px-2 py-1"
              value={selectedSessionId || ''}
              onChange={(e) => {
                const id = e.target.value || '';
                if (id) selectSession(id);
                else setSelectedSessionId(null);
              }}
            >
              <option value="">Active Chat</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title || 'Untitled'}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedSessionId}
              onClick={() => startRenaming(selectedSessionId)}
              className="text-xs text-secondary-700 hover:text-secondary-900 bg-secondary-100 border border-secondary-200 px-2 py-1 rounded-md inline-flex items-center disabled:opacity-50"
              title="Rename selected"
            >
              <PencilSquareIcon className="h-4 w-4 mr-1" /> Rename
            </button>
            <button
              type="button"
              disabled={!selectedSessionId}
              onClick={() => deleteSession(selectedSessionId)}
              className="text-xs text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-md inline-flex items-center disabled:opacity-50"
              title="Delete selected"
            >
              <TrashIcon className="h-4 w-4 mr-1" /> Delete
            </button>
          </div>
          {lastMeta && (
            <span className="text-xs bg-secondary-100 text-secondary-700 px-2 py-1 rounded-md border border-secondary-200">
              {lastMeta.provider ? `${lastMeta.provider}` : 'atlas'}{lastMeta.model ? ` · ${lastMeta.model}` : ''}
            </span>
          )}
          <label className="flex items-center space-x-2 text-sm text-secondary-700">
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
              className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="inline-flex items-center">
              <BugAntIcon className="h-4 w-4 mr-1" /> Debug
            </span>
          </label>
          <label className="flex items-center space-x-2 text-sm text-secondary-700">
            <input
              type="checkbox"
              checked={lite}
              onChange={(e) => setLite(e.target.checked)}
              className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="inline-flex items-center">
              Lite Mode
            </span>
          </label>
        </div>
      </div>

      {renamingId === selectedSessionId && (
        <div className="px-6 py-2 border-b border-secondary-200">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              className="rounded-lg border border-secondary-300 px-2 py-1 text-sm"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              placeholder="Enter new title"
            />
            <button
              type="button"
              onClick={applyRename}
              className="text-xs text-primary-600 hover:text-primary-700 bg-primary-50 border border-primary-200 px-2 py-1 rounded-md"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setRenamingId(null); setRenameText(''); }}
              className="text-xs text-secondary-700 hover:text-secondary-900 bg-secondary-100 border border-secondary-200 px-2 py-1 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div ref={chatRef} className="px-6 py-6 max-h-[60vh] overflow-y-auto space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative max-w-[70%] px-4 py-2 rounded-2xl text-sm shadow-sm ${m.role === 'user' ? 'bg-primary-600 text-white rounded-br-none' : 'bg-secondary-100 text-secondary-900 rounded-bl-none'}`}>
              {m.role === 'assistant' ? (
                <ReactMarkdown allowedElements={['p','strong','em','ul','li','br']}>
                  {m.content}
                </ReactMarkdown>
              ) : (
                m.content
              )}

            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-2xl bg-secondary-100 text-secondary-600 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        {!loading && lastError && lastUserText && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => doSend(lastUserText)}
              className="text-xs text-primary-600 hover:text-primary-700 bg-primary-50 border border-primary-200 px-2 py-1 rounded-md"
            >
              Retry last message
            </button>
          </div>
        )}
      </div>

      {/* Debug panel */}
      {debug && (
        <div className="px-6 pb-4">
          <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4 text-xs text-secondary-800">
            <div className="font-semibold mb-2">Debug Info</div>
            {lastMeta ? (
              <pre className="overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(lastMeta, null, 2)}
              </pre>
            ) : (
              <div className="text-secondary-600">No meta yet. Send a message to populate.</div>
            )}
            {lastError && (
              <div className="mt-3">
                <div className="font-semibold">Last Error</div>
                <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(lastError, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="px-6 py-4 border-t border-secondary-200">
        <div className="flex items-center space-x-3">
          <input
            type="text"
            className="flex-1 rounded-lg border border-secondary-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ask about budgets, spending, or categories..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            title="Send"
          >
            {loading ? (
              <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="h-5 w-5 mr-1" />
            )}
            {loading ? 'Sending' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Assistant;