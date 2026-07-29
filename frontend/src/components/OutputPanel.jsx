export default function OutputPanel({ output, running, onRun }) {
  return (
    <div className="output-panel">
      <div className="output-header">
        <h4>Output</h4>
        <button onClick={onRun} disabled={running} className="run-btn">
          {running ? 'Running...' : '▶ Run'}
        </button>
      </div>
      <div className="output-body">
        {!output && !running && <span className="output-placeholder">Click Run to execute your code</span>}
        {running && <span className="output-placeholder">Executing...</span>}
        {output && (
          <>
            {output.ranBy && <div className="ran-by">Run by {output.ranBy}</div>}
            {output.stdout && <pre className="stdout">{output.stdout}</pre>}
            {output.stderr && <pre className="stderr">{output.stderr}</pre>}
            {output.timedOut && <div className="timeout-warning">⚠ Execution timed out (5s limit)</div>}
            {!output.stdout && !output.stderr && !output.timedOut && (
              <span className="output-placeholder">(no output)</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
