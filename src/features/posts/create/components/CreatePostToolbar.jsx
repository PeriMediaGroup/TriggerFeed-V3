"use client";

import { ChartColumn, FileImage, ImagePlus, SmilePlus } from "lucide-react";

const CREATE_POST_TOOLS = [
  {
    name: "media",
    label: "Photo/Video",
    Icon: ImagePlus,
  },
  {
    name: "emoji",
    label: "Emoji",
    Icon: SmilePlus,
  },
  {
    name: "gif",
    label: "GIF",
    Icon: FileImage,
  },
  {
    name: "poll",
    label: "Poll",
    Icon: ChartColumn,
  },
];

export default function CreatePostToolbar({ activeTool, onSelectTool }) {
  function toggleTool(toolName) {
    onSelectTool(activeTool === toolName ? null : toolName);
  }

  return (
    <div className="create-post__toolbar" aria-label="Create post tools">
      {CREATE_POST_TOOLS.map((tool) => {
        const isActive = activeTool === tool.name;
        const Icon = tool.Icon;

        return (
          <button
            key={tool.name}
            type="button"
            className={`create-post__tool-button${
              isActive ? " create-post__tool-button--active" : ""
            }`}
            onClick={() => toggleTool(tool.name)}
            aria-pressed={isActive}
          >
            <Icon
              className="create-post__tool-icon"
              size={18}
              strokeWidth={2.25}
              aria-hidden="true"
            />
            <span>{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
}