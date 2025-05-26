import { useState, useEffect } from "preact/hooks";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import "./App.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Settings {
  baseURL: string;
  apiKey: string;
}

const DEFAULT_SETTINGS: Settings = {
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "",
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tempSettings, setTempSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("chatalyst-settings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setTempSettings(parsed);
    }
  }, []);

  // Create AI provider with current settings
  const getAIProvider = () => {
    return createOpenAICompatible({
      name: "custom-ai-provider",
      baseURL: settings.baseURL,
      apiKey: settings.apiKey || "openrouter",
    });
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Call the AI with current settings
      const aiProvider = getAIProvider();
      const result = await streamText({
        model: aiProvider("gpt-4-turbo"),
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Stream the response
      let fullContent = "";
      for await (const chunk of result.textStream) {
        fullContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id ? { ...m, content: fullContent } : m,
          ),
        );
      }
    } catch (err) {
      setError(err as Error);
      // Remove the empty assistant message on error
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = () => {
    setSettings(tempSettings);
    localStorage.setItem("chatalyst-settings", JSON.stringify(tempSettings));
    setShowSettings(false);
  };

  const handleCancelSettings = () => {
    setTempSettings(settings);
    setShowSettings(false);
  };

  return (
    <main class="container">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ margin: 0 }}>Chatalyst</h1>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "24px",
            padding: "8px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: 999,
            }}
            onClick={handleCancelSettings}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "8px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
              zIndex: 1000,
              minWidth: "400px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Settings</h2>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px" }}>
                Base URL:
              </label>
              <input
                type="text"
                value={tempSettings.baseURL}
                onInput={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    baseURL: (e.target as HTMLInputElement).value,
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px" }}>
                API Key:
              </label>
              <input
                type="password"
                value={tempSettings.apiKey}
                onInput={(e) =>
                  setTempSettings({
                    ...tempSettings,
                    apiKey: (e.target as HTMLInputElement).value,
                  })
                }
                placeholder="Leave blank to use 'openrouter'"
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleCancelSettings}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  background: "#007bff",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 200px)",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          {messages.length === 0 ? (
            <p style={{ textAlign: "center", color: "#666" }}>
              Start a conversation...
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                style={{
                  marginBottom: "16px",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor:
                    message.role === "user" ? "#e3f2fd" : "#f5f5f5",
                }}
              >
                <strong>{message.role === "user" ? "You" : "AI"}:</strong>
                <p style={{ margin: "8px 0 0 0" }}>
                  {message.content || <em>Typing...</em>}
                </p>
              </div>
            ))
          )}
        </div>

        {error && (
          <div
            style={{
              color: "red",
              marginBottom: "10px",
              padding: "10px",
              backgroundColor: "#ffebee",
              borderRadius: "4px",
            }}
          >
            Error: {error.message || error.toString()}
          </div>
        )}

        <form onSubmit={handleSubmit} class="row">
          <input
            value={input}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            placeholder="Type your message..."
            style={{ flex: 1 }}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default App;
