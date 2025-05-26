import { useState, useEffect } from "preact/hooks";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

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
    <main class="m-0 pt-[10vh] flex flex-col justify-center text-center">
      <div class="flex items-center justify-between mb-5">
        <h1 class="m-0 text-center">Chatalyst</h1>
        <button
          onClick={() => setShowSettings(true)}
          class="bg-transparent border-none cursor-pointer text-2xl p-2 rounded flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {showSettings && (
        <>
          <div
            class="fixed inset-0 bg-black/50 z-[999]"
            onClick={handleCancelSettings}
          />
          <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.2)] z-[1000] min-w-[400px]">
            <h2 class="mt-0">Settings</h2>

            <div class="mb-4">
              <label class="block mb-2">
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
                class="w-full p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div class="mb-6">
              <label class="block mb-2">
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
                class="w-full p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              />
            </div>

            <div class="flex gap-2 justify-end">
              <button
                onClick={handleCancelSettings}
                class="px-4 py-2 rounded border border-gray-300 bg-white dark:bg-gray-700 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                class="px-4 py-2 rounded border-none bg-blue-500 text-white cursor-pointer hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      <div class="flex flex-col h-[calc(100vh-200px)] max-w-[800px] mx-auto">
        <div class="flex-1 overflow-y-auto p-5 border border-gray-300 dark:border-gray-600 rounded-lg mb-5 bg-white dark:bg-gray-800">
          {messages.length === 0 ? (
            <p class="text-center text-gray-600 dark:text-gray-400">
              Start a conversation...
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                class={`mb-4 p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <strong>{message.role === "user" ? "You" : "AI"}:</strong>
                <p class="mt-2 mb-0">
                  {message.content || <em>Typing...</em>}
                </p>
              </div>
            ))
          )}
        </div>

        {error && (
          <div class="text-red-600 dark:text-red-400 mb-2.5 p-2.5 bg-red-50 dark:bg-red-900/20 rounded">
            Error: {error.message || error.toString()}
          </div>
        )}

        <form onSubmit={handleSubmit} class="flex justify-center gap-2">
          <input
            value={input}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            placeholder="Type your message..."
            class="flex-1 rounded-lg border border-transparent px-3 py-2 text-base font-medium bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200 outline-none focus:border-blue-500 dark:focus:border-blue-400"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()} class="rounded-lg border border-transparent px-4 py-2 text-base font-medium bg-white dark:bg-gray-800 shadow-sm transition-all duration-200 cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 active:bg-gray-100 dark:active:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default App;
