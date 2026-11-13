import { capitalizeFirstLetter } from "../../../validation";

export interface StageManagerInputProps {
  stages: string[];
  newStageInput: string;
  stageInputError: string;
  orderErrorStage?: string;
  disabled?: boolean;
  onNewStageInputChange: (val: string) => void;
  onAddStage: () => void;
  onRemoveStage: (index: number) => void;
  onMoveStage: (index: number, direction: "up" | "down") => void;
  onEditStageName: (index: number, newName: string) => void;
  onResetDefaultStages: () => void;
}

export function StageManagerInput({
  stages,
  newStageInput,
  stageInputError,
  orderErrorStage,
  disabled = false,
  onNewStageInputChange,
  onAddStage,
  onRemoveStage,
  onMoveStage,
  onEditStageName,
  onResetDefaultStages,
}: StageManagerInputProps) {
  return (
    <div className="stages-container">
      {/* Section Header */}
      <div className="stages-header">
        <div className="stages-title-wrap">
          <label className="stages-title">
            Production Stages
          </label>
          <span className="stages-badge">
            {stages.length}/15
          </span>
        </div>
        <button
          type="button"
          onClick={onResetDefaultStages}
          disabled={disabled}
          className="stages-reset-btn"
          title="Reset to default stages"
        >
          Reset to Defaults
        </button>
      </div>

      <p className="stages-subtitle">
        Customize, reorder (↑/↓), or rename production stages for this custom boutique order.
      </p>

      {/* Stage Rows */}
      <div className="stages-list">
        {stages.map((stageName, index) => {
          const isFirst = index === 0;
          const isLast = index === stages.length - 1;
          const isOnlyOne = stages.length <= 1;

          return (
            <div key={index} className="stage-row">
              <span className="stage-row-number" aria-hidden="true">
                {index + 1}.
              </span>
              <input
                type="text"
                value={stageName}
                maxLength={50}
                disabled={disabled}
                onChange={(e) => onEditStageName(index, capitalizeFirstLetter(e.target.value))}
                placeholder={`Stage ${index + 1} name`}
                className="stage-row-input"
                aria-label={`Stage ${index + 1} name`}
              />
              <div className="stage-actions">
                <button
                  type="button"
                  disabled={isFirst || disabled}
                  onClick={() => onMoveStage(index, "up")}
                  className="stage-action-btn"
                  title="Move stage up"
                  aria-label={`Move stage ${index + 1} up`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={isLast || disabled}
                  onClick={() => onMoveStage(index, "down")}
                  className="stage-action-btn"
                  title="Move stage down"
                  aria-label={`Move stage ${index + 1} down`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={isOnlyOne || disabled}
                  onClick={() => onRemoveStage(index)}
                  className={`stage-action-btn stage-action-delete ${isOnlyOne ? "disabled-delete" : ""}`}
                  title={isOnlyOne ? "At least one stage required" : "Delete stage"}
                  aria-label={`Delete stage ${index + 1}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Stage */}
      <div className="stages-add-section">
        <div className="stages-add-input-group">
          <input
            type="text"
            placeholder="Enter new stage name..."
            value={newStageInput}
            maxLength={50}
            disabled={disabled || stages.length >= 15}
            onChange={(e) => onNewStageInputChange(capitalizeFirstLetter(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddStage();
              }
            }}
            className="stages-add-input"
            aria-label="New stage name"
          />
          <button
            type="button"
            disabled={disabled || stages.length >= 15}
            onClick={onAddStage}
            className="stages-add-btn"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Production Stage</span>
          </button>
        </div>
      </div>

      {stageInputError && (
        <div className="error-message" style={{ marginTop: "8px" }}>
          {stageInputError}
        </div>
      )}
      {orderErrorStage && (
        <div className="error-message" style={{ marginTop: "8px" }}>
          {orderErrorStage}
        </div>
      )}
    </div>
  );
}
