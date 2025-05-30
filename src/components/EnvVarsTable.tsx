import { useState } from "preact/hooks";

interface EnvVarsTableProps {
  env: Record<string, string>;
  onChange: (env: Record<string, string>) => void;
}

export function EnvVarsTable({ env, onChange }: EnvVarsTableProps) {
  const entries = Object.entries(env || {});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  return (
    <table class="env-table">
      <thead>
        <tr>
          <th style={{ width: "40%" }}>Name</th>
          <th style={{ width: "50%" }}>Value</th>
          <th style={{ width: "10%" }}></th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value], idx, arr) => (
          <tr key={key + idx}>
            <td>
              <label>{key}</label>
            </td>
            <td>
              <label>{value}</label>
            </td>
            <td>
              <button
                type="button"
                class="env-remove-btn"
                onClick={() => {
                  const newEnv = { ...env };
                  delete newEnv[key];
                  onChange(newEnv);
                }}
                title="Remove"
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
        <tr key="new-entry">
          <td>
            <input
              type="text"
              value={newKey}
              onInput={(e) => {
                console.log(e.currentTarget.value);
                setNewKey(e.currentTarget.value);
              }}
              placeholder="KEY"
              autoCorrect="off"
              autoCapitalize="off"
              spellcheck={false}
            />
          </td>
          <td>
            <input
              type="text"
              value={newValue}
              onInput={(e) => {
                setNewValue(e.currentTarget.value);
              }}
              placeholder="value"
              autoCorrect="off"
              autoCapitalize="off"
              spellcheck={false}
            />
          </td>
          <td>
            <button
              type="button"
              class="env-add-btn"
              disabled={newKey.trim() === "" || newValue.trim() === ""}
              onClick={() => {
                const newEnv = { ...env };
                newEnv[newKey.trim()] = newValue.trim();
                onChange(newEnv);
                setNewKey("");
                setNewValue("");
              }}
            >
              Add
            </button>
          </td>
        </tr>
      </tbody>
      <style>{`
        .env-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0.5rem;
        }

        .env-table th, .env-table td {
          border: 1px solid #e0e0e0;
          padding: 0.25rem 0.5rem;
        }

        .env-table input[type="text"] {
          width: 100%;
          box-sizing: border-box;
          padding: 0.25rem;
          font-size: 0.9rem;
        }

        .env-add-btn, .env-remove-btn {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 1rem;
          padding: 0.1rem 0.5rem;
          margin: 0;
        }

        .env-add-btn:hover:enabled {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .env-remove-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
    `}</style>
    </table>
  );
}
