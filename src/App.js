import { useEffect, useRef, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const PAGE_SIZE_OPTIONS = [10, 100, 1000];
const DEFAULT_PAGE_SIZE = 100;

const font = `'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace`;
const fontSans = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

const C = {
  bg: '#08080c',
  bg2: '#0e0e14',
  bg3: '#15151e',
  bg4: '#1c1c28',
  border: '#252536',
  borderHover: '#3a3a52',
  text: '#d8d8e8',
  text2: '#8a8aa4',
  text3: '#555570',
  accent: '#00e5a0',
  accentDim: 'rgba(0,229,160,0.08)',
  accentMid: 'rgba(0,229,160,0.2)',
  warn: '#ff6b6b',
  warnDim: 'rgba(255,107,107,0.1)',
  blue: '#5eafff',
  blueDim: 'rgba(94,175,255,0.1)',
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

async function fetchPreviewPage(fileId, offset, limit) {
  const res = await fetch(
    `${BACKEND_URL}/preview/${fileId}/?offset=${offset}&limit=${limit}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function App() {
  const [view, setView] = useState('upload');
  const [fileInfo, setFileInfo] = useState(null);
  const [originalId, setOriginalId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [history, setHistory] = useState([]);
  const [globalToast, setGlobalToast] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const reset = () => {
    setView('upload');
    setFileInfo(null);
    setOriginalId(null);
    setActiveId(null);
    setColumns([]);
    setRows([]);
    setHasMore(false);
    setPreviewError(null);
    setHistory([]);
  };

  const loadPreview = async (fileId, reset = true, limitOverride = null) => {
    try {
      const offset = reset ? 0 : rows.length;
      const limit = limitOverride ?? Math.max(pageSize, 100);
      const data = await fetchPreviewPage(fileId, offset, limit);
      setColumns(data.columns || []);
      setRows((prev) => (reset ? data.rows : [...prev, ...data.rows]));
      setHasMore(!!data.has_more);
      setPreviewError(null);
    } catch (e) {
      setPreviewError(e.message);
    }
  };

  const handleFileLoaded = async (info) => {
    setFileInfo(info);
    setOriginalId(info.id);
    setActiveId(info.id);
    setRows([]);
    setHistory([]);
    setView('workspace');
    await loadPreview(info.id, true);
  };

  const handleTransformDone = async ({ downloadId, matchCount, rowCount, log }) => {
    setActiveId(downloadId);
    setRows([]);
    setHistory((h) => [{ ...log, time: new Date().toLocaleTimeString() }, ...h]);
    setFileInfo((f) => f && { ...f, rowCount });
    setGlobalToast({
      kind: 'ok',
      msg: `${matchCount} match${matchCount === 1 ? '' : 'es'} replaced · ${rowCount} rows`,
    });
    await loadPreview(downloadId, true);
    setTimeout(() => setGlobalToast(null), 4000);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: fontSans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background: ${C.bg}; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:${C.borderHover}; }
        ::selection { background:${C.accentMid}; }
        button, input, select, textarea { font-family: inherit; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:.4; } 50% { opacity:1; } }
        @keyframes gridPulse { 0%,100% { opacity:.03; } 50% { opacity:.06; } }
      `}</style>

      <Header fileInfo={fileInfo} onReset={reset} />
      {globalToast && <Toast kind={globalToast.kind} msg={globalToast.msg} />}

      {view === 'upload' ? (
        <UploadView onFileLoaded={handleFileLoaded} />
      ) : (
        <Workspace
          columns={columns}
          rows={rows}
          hasMore={hasMore}
          previewError={previewError}
          originalId={originalId}
          activeId={activeId}
          isTransformed={activeId !== originalId}
          fileInfo={fileInfo}
          history={history}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onLoadMore={(limit) => loadPreview(activeId, false, limit)}
          onTransformDone={handleTransformDone}
          onResetToOriginal={async () => {
            setActiveId(originalId);
            setRows([]);
            await loadPreview(originalId, true);
          }}
        />
      )}
    </div>
  );
}

function Header({ fileInfo, onReset }) {
  return (
    <div
      style={{
        height: 56,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: C.bg2,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 22,
            height: 22,
            background: `linear-gradient(135deg, ${C.accent}, #00b8d4)`,
            borderRadius: 5,
            transform: 'rotate(45deg)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: font, fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em' }}>
          RhombusRegex
        </span>
        <span style={{ fontSize: 11, color: C.text3, fontFamily: font }}>v1.0</span>
      </div>

      {fileInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: C.text2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.accent }}>●</span>
            {fileInfo.name}
          </span>
          <span style={{ color: C.text3 }}>·</span>
          <span>{formatBytes(fileInfo.size)}</span>
          <HoverButton onClick={onReset} hoverColor={C.warn}>
            New File
          </HoverButton>
        </div>
      )}
    </div>
  );
}

function HoverButton({ children, onClick, hoverColor = C.accent, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        padding: '5px 12px',
        borderRadius: 6,
        border: `1px solid ${hover && !disabled ? hoverColor : C.border}`,
        background: 'transparent',
        color: disabled ? C.text3 : hover ? hoverColor : C.text2,
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  );
}

function Toast({ kind, msg }) {
  const color = kind === 'ok' ? C.accent : C.warn;
  return (
    <div
      style={{
        position: 'fixed',
        top: 72,
        right: 24,
        padding: '10px 16px',
        background: C.bg3,
        border: `1px solid ${color}`,
        color,
        borderRadius: 8,
        fontSize: 13,
        zIndex: 200,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        animation: 'fadeUp .3s ease',
      }}
    >
      {msg}
    </div>
  );
}

function UploadView({ onFileLoaded }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls', 'xlsm', 'xlsb'].includes(ext)) {
      setError('Unsupported file type. Use CSV or Excel.');
      return;
    }
    setError('');
    setLoading(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const res = await fetch(`${BACKEND_URL}/upload/`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      onFileLoaded({ id: data.id, name: data.name, size: data.size, type: data.content_type });
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 56px)',
        padding: '40px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          opacity: 0.04,
          animation: 'gridPulse 8s ease-in-out infinite',
        }}
      />

      <div style={{ animation: 'fadeUp .6s ease', position: 'relative', textAlign: 'center' }}>
        <h1 style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 12 }}>
          Pattern Match
          <br />
          <span style={{ color: C.accent }}>& Replace</span>
        </h1>
        <p style={{ color: C.text2, fontSize: 16, maxWidth: 440, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Upload your data, describe what to find in plain English, and let the LLM generate the regex for you.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}
          onClick={() => !loading && inputRef.current?.click()}
          style={{
            width: 480,
            maxWidth: '100%',
            border: `2px dashed ${dragging ? C.accent : C.border}`,
            borderRadius: 16,
            padding: '52px 32px',
            cursor: loading ? 'wait' : 'pointer',
            background: dragging ? C.accentDim : C.bg2,
            transition: 'all .2s',
            position: 'relative',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  border: `3px solid ${C.border}`,
                  borderTopColor: C.accent,
                  borderRadius: '50%',
                  animation: 'spin .7s linear infinite',
                }}
              />
              <span style={{ color: C.text2, fontSize: 14 }}>Uploading & parsing…</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.7 }}>⌬</div>
              <p style={{ color: C.text, fontSize: 15, marginBottom: 6 }}>
                Drop your file here or <span style={{ color: C.accent, fontWeight: 600 }}>browse</span>
              </p>
              <p style={{ color: C.text3, fontSize: 12, fontFamily: font }}>
                .csv · .xlsx · .xls · .xlsm · .xlsb
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm,.xlsb"
            style={{ display: 'none' }}
            onChange={(e) => upload(e.target.files[0])}
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              background: C.warnDim,
              border: `1px solid ${C.warn}`,
              color: C.warn,
              borderRadius: 8,
              fontSize: 13,
              maxWidth: 480,
              marginInline: 'auto',
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function Workspace({
  columns, rows, hasMore, previewError,
  originalId, activeId, isTransformed, fileInfo, history,
  pageSize, onPageSizeChange,
  onLoadMore, onTransformDone, onResetToOriginal,
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', minHeight: 'calc(100vh - 56px)' }}>
      <Sidebar
        columns={columns}
        originalId={originalId}
        activeId={activeId}
        history={history}
        onTransformDone={onTransformDone}
      />
      <MainContent
        columns={columns}
        rows={rows}
        hasMore={hasMore}
        previewError={previewError}
        activeId={activeId}
        isTransformed={isTransformed}
        fileInfo={fileInfo}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        onLoadMore={onLoadMore}
        onResetToOriginal={onResetToOriginal}
      />
    </div>
  );
}

function Sidebar({ columns, originalId, activeId, history, onTransformDone }) {
  const [targetCol, setTargetCol] = useState('');
  const [description, setDescription] = useState('');
  const [generatedRegex, setGeneratedRegex] = useState('');
  const [explanation, setExplanation] = useState('');
  const [replacement, setReplacement] = useState('');
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (columns.length > 0 && !columns.includes(targetCol)) {
      setTargetCol(columns[0]);
    }
  }, [columns, targetCol]);

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Describe a pattern first.');
      return;
    }
    setError('');
    setGenerating(true);
    setGeneratedRegex('');
    setExplanation('');
    try {
      const res = await fetch(`${BACKEND_URL}/generate-regex/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: originalId,
          target_column: targetCol,
          description: description.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setGeneratedRegex(data.regex || '');
        setExplanation(data.explanation || '');
        if (typeof data.replacement === 'string') {
          setReplacement(data.replacement);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!generatedRegex) {
      setError('Generate a regex first.');
      return;
    }
    setError('');
    setApplying(true);
    try {
      const res = await fetch(`${BACKEND_URL}/transform/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: originalId,
          target_column: targetCol,
          regex: generatedRegex,
          replacement,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        onTransformDone({
          downloadId: data.download_id,
          matchCount: data.match_count,
          rowCount: data.row_count,
          log: {
            col: targetCol,
            description: description.trim(),
            regex: generatedRegex,
            replacement,
            matches: data.match_count,
            downloadId: data.download_id,
          },
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: C.text3,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontFamily: font,
  };
  const inputStyle = {
    width: '100%',
    padding: '10px 13px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.bg,
    color: C.text,
    fontSize: 13,
    outline: 'none',
    transition: 'border-color .15s',
  };

  return (
    <div
      style={{
        borderRight: `1px solid ${C.border}`,
        background: C.bg2,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 56px)',
        padding: 22,
        animation: 'fadeIn .4s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: C.accent,
            boxShadow: `0 0 8px ${C.accent}`,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>
          Pattern Match & Replace
        </span>
      </div>

      <label style={labelStyle}>Target Column</label>
      <select
        value={targetCol}
        onChange={(e) => setTargetCol(e.target.value)}
        style={{
          ...inputStyle,
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23555570' d='M5 7L1 3h8z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          marginBottom: 14,
        }}
      >
        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <label style={labelStyle}>Describe Pattern</label>
      <input
        value={description}
        onChange={(e) => { setDescription(e.target.value); setGeneratedRegex(''); }}
        placeholder="e.g. Find email addresses"
        style={{ ...inputStyle, marginBottom: 10 }}
        onFocus={(e) => (e.target.style.borderColor = C.accent)}
        onBlur={(e) => (e.target.style.borderColor = C.border)}
        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
      />
      <button
        onClick={handleGenerate}
        disabled={generating || !description.trim()}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: 8,
          border: `1px solid ${generating || !description.trim() ? C.border : C.blue}`,
          background: generating ? C.bg4 : 'transparent',
          color: generating || !description.trim() ? C.text3 : C.blue,
          fontSize: 12,
          fontWeight: 600,
          cursor: generating || !description.trim() ? 'not-allowed' : 'pointer',
          transition: 'all .15s',
          marginBottom: 14,
        }}
      >
        {generating ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner color={C.text3} />
            LLM is generating regex…
          </span>
        ) : (
          'Generate Regex'
        )}
      </button>

      {generatedRegex && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 8,
            background: C.bg3,
            border: `1px solid ${C.border}`,
            animation: 'fadeUp .3s ease',
          }}
        >
          <div style={{ fontSize: 10, color: C.text3, marginBottom: 6, fontFamily: font, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Generated Regex (editable)
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              background: C.bg,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              padding: '6px 8px',
              marginBottom: 6,
              fontFamily: font,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: C.text3, marginRight: 4 }}>/</span>
            <textarea
              value={generatedRegex}
              onChange={(e) => setGeneratedRegex(e.target.value)}
              spellCheck={false}
              rows={Math.max(1, Math.min(4, Math.ceil(generatedRegex.length / 38)))}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: C.accent,
                fontFamily: font,
                fontSize: 11,
                lineHeight: 1.5,
                resize: 'vertical',
                wordBreak: 'break-all',
                padding: 0,
              }}
            />
            <span style={{ color: C.text3, marginLeft: 4 }}>/g</span>
          </div>
          {explanation && (
            <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.5 }}>{explanation}</div>
          )}
        </div>
      )}

      <label style={labelStyle}>Replace With</label>
      <input
        value={replacement}
        onChange={(e) => setReplacement(e.target.value)}
        placeholder="e.g. REDACTED  (empty to remove)"
        style={{ ...inputStyle, marginBottom: 16, fontFamily: font }}
        onFocus={(e) => (e.target.style.borderColor = C.accent)}
        onBlur={(e) => (e.target.style.borderColor = C.border)}
      />

      <button
        onClick={handleApply}
        disabled={applying || !generatedRegex}
        style={{
          width: '100%',
          padding: '11px 20px',
          borderRadius: 8,
          border: 'none',
          background: applying || !generatedRegex ? C.bg4 : C.accent,
          color: applying || !generatedRegex ? C.text3 : C.bg,
          fontSize: 13,
          fontWeight: 600,
          cursor: applying || !generatedRegex ? 'not-allowed' : 'pointer',
          transition: 'all .15s',
          letterSpacing: '-0.01em',
        }}
      >
        {applying ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner color={C.text3} />
            Applying…
          </span>
        ) : (
          'Apply Transformation'
        )}
      </button>

      {error && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 8,
            background: C.warnDim,
            color: C.warn,
            fontSize: 12,
            border: `1px solid ${C.warn}`,
          }}
        >
          {error}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, marginTop: 24 }}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>History</div>
          {history.map((log, i) => (
            <div
              key={i}
              style={{
                padding: '10px 12px',
                borderRadius: 7,
                background: C.bg3,
                marginBottom: 6,
                fontSize: 12,
                animation: i === 0 ? 'fadeUp .3s ease' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: C.text, fontWeight: 500 }}>{log.col}</span>
                <span style={{ color: C.text3, fontFamily: font, fontSize: 10 }}>{log.time}</span>
              </div>
              <div style={{ color: C.text2, marginBottom: 4 }}>{log.description}</div>
              <div
                style={{
                  fontFamily: font,
                  fontSize: 10,
                  color: C.text3,
                  marginBottom: 4,
                  wordBreak: 'break-all',
                }}
              >
                /{log.regex}/g
              </div>
              <div style={{ color: C.accent, fontFamily: font, fontSize: 10 }}>
                {log.matches} match{log.matches === 1 ? '' : 'es'} → "{log.replacement || '(empty)'}"
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner({ color }) {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        border: `2px solid ${color}`,
        borderTopColor: C.text,
        borderRadius: '50%',
        animation: 'spin .7s linear infinite',
        display: 'inline-block',
      }}
    />
  );
}

function MainContent({
  columns, rows, hasMore, previewError,
  activeId, isTransformed, fileInfo,
  pageSize, onPageSizeChange,
  onLoadMore, onResetToOriginal,
}) {
  const [page, setPage] = useState(0);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [activeId, pageSize]);

  const totalLoaded = rows.length;
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const lastLoadedPage = Math.max(0, Math.ceil(totalLoaded / pageSize) - 1);
  const canNext = (page + 1) * pageSize < totalLoaded || hasMore;
  const canPrev = page > 0;

  const handleNext = async () => {
    if ((page + 1) * pageSize >= totalLoaded && hasMore) {
      setLoadingMore(true);
      await onLoadMore(Math.max(pageSize, 100));
      setLoadingMore(false);
    }
    setPage((p) => p + 1);
  };

  const downloadUrl = isTransformed ? `${BACKEND_URL}/download/${activeId}/` : null;

  return (
    <div
      style={{
        padding: '22px 24px',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 56px)',
        animation: 'fadeIn .5s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {isTransformed ? 'Transformed Preview' : 'Data Preview'}
          </span>
          <span style={{ fontSize: 12, color: C.text3, fontFamily: font }}>
            {totalLoaded}{hasMore ? '+' : ''} rows loaded × {columns.length} cols
          </span>
          {isTransformed && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 999,
                background: C.accentDim,
                color: C.accent,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: font,
              }}
            >
              Transformed
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {isTransformed && (
            <HoverButton onClick={onResetToOriginal}>View Original</HoverButton>
          )}
          {downloadUrl && (
            <a
              href={downloadUrl}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: `1px solid ${C.accent}`,
                background: C.accentDim,
                color: C.accent,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all .15s',
              }}
            >
              ↓ Download CSV
            </a>
          )}
        </div>
      </div>

      {previewError && (
        <div
          style={{
            padding: '10px 14px',
            background: C.warnDim,
            border: `1px solid ${C.warn}`,
            color: C.warn,
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {previewError}
        </div>
      )}

      <div
        style={{
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          background: C.bg2,
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle('50px')}>#</th>
                {columns.map((c) => (
                  <th key={c} style={thStyle('auto')}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 24, textAlign: 'center', color: C.text3, fontSize: 13 }}>
                    {previewError ? 'Failed to load preview.' : 'Loading…'}
                  </td>
                </tr>
              )}
              {pageRows.map((row, i) => {
                const idx = page * pageSize + i;
                const isHovered = hoveredRow === idx;
                return (
                  <tr
                    key={idx}
                    onMouseEnter={() => setHoveredRow(idx)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: isHovered ? C.accentDim : 'transparent',
                      transition: 'background .1s',
                    }}
                  >
                    <td style={tdStyle({ color: C.text3, fontFamily: font, fontSize: 11 })}>
                      {idx + 1}
                    </td>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        title={String(cell ?? '')}
                        style={tdStyle({
                          color: C.text,
                          fontFamily: font,
                          fontSize: 12,
                          maxWidth: 260,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        })}
                      >
                        {String(cell ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderTop: `1px solid ${C.border}`,
            fontSize: 12,
            color: C.text3,
            fontFamily: font,
          }}
        >
          <span>
            Page {page + 1}
            {!hasMore ? ` of ${lastLoadedPage + 1}` : ''}
            {loadingMore ? ' · loading…' : ''}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={{ color: C.text3, fontSize: 11, fontFamily: font }}>Rows</label>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 22px 4px 10px',
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: C.bg,
                color: C.text2,
                fontSize: 12,
                fontFamily: font,
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23555570' d='M5 7L1 3h8z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                cursor: 'pointer',
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <PageButton disabled={!canPrev} onClick={() => setPage((p) => p - 1)}>← Prev</PageButton>
            <PageButton disabled={!canNext || loadingMore} onClick={handleNext}>Next →</PageButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function thStyle(width) {
  return {
    padding: '10px 14px',
    background: C.bg3,
    color: C.text3,
    fontWeight: 600,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    fontFamily: font,
    textAlign: 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    width,
  };
}

function tdStyle(extra) {
  return {
    padding: '9px 14px',
    borderBottom: `1px solid ${C.border}`,
    ...extra,
  };
}

function PageButton({ disabled, onClick, children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 6,
        border: `1px solid ${C.border}`,
        background: 'transparent',
        color: disabled ? C.text3 : C.text2,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12,
        fontFamily: font,
      }}
    >
      {children}
    </button>
  );
}
