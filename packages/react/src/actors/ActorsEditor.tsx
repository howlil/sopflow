import { useState } from "react";
import type { Actor, SOPDocument, SopOperation } from "@sopflow/core";
import { createActorId } from "../utils/createActorId.js";
import { DeleteActorDialog } from "./DeleteActorDialog.js";
import styles from "./ActorsEditor.module.css";

export interface ActorsEditorProps {
  document: SOPDocument;
  onOperation: (operation: SopOperation) => void;
  onOperations: (operations: SopOperation[]) => void;
  disabled?: boolean;
}

export function ActorsEditor({
  document,
  onOperation,
  onOperations,
  disabled = false,
}: ActorsEditorProps) {
  const [actorToDelete, setActorToDelete] = useState<Actor | null>(null);

  function handleAdd() {
    const actor: Actor = {
      id: createActorId(),
      name: "",
    };

    onOperation({
      type: "add-actor",
      actor,
    });
  }

  function handleNameChange(actor: Actor, name: string) {
    onOperation({
      type: "update-actor",
      actor: {
        ...actor,
        name,
      },
    });
  }

  return (
    <section
      className={styles.editor}
      data-empty={document.actors.length === 0 || undefined}
      data-disabled={disabled || undefined}
    >
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Pelaksana</h2>

          <p className={styles.description}>
            Daftar aktor yang dapat menjalankan langkah SOP.
          </p>
        </div>

        {!disabled ? (
          <button
            type="button"
            className={styles.addButton}
            onClick={handleAdd}
          >
            + Tambah pelaksana
          </button>
        ) : null}
      </header>

      {document.actors.length > 0 ? (
        <div className={styles.list}>
          {document.actors.map((actor, index) => (
            <div
              key={actor.id}
              className={styles.actor}
              data-sopflow-actor-id={actor.id}
            >
              <span className={styles.number}>{index + 1}</span>

              {disabled ? (
                <span className={styles.actorName}>
                  {actor.name || "Tanpa nama"}
                </span>
              ) : (
                <input
                  className={styles.nameInput}
                  value={actor.name}
                  placeholder="Nama pelaksana"
                  aria-label={`Nama pelaksana ${index + 1}`}
                  data-empty={!actor.name || undefined}
                  onChange={(event) =>
                    handleNameChange(actor, event.target.value)
                  }
                />
              )}

              {!disabled ? (
                <button
                  type="button"
                  className={styles.removeButton}
                  aria-label={`Hapus ${actor.name || "pelaksana"}`}
                  onClick={() => setActorToDelete(actor)}
                >
                  Hapus
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>Belum ada pelaksana.</div>
      )}

      {actorToDelete ? (
        <DeleteActorDialog
          open
          actor={actorToDelete}
          document={document}
          disabled={disabled}
          onOperations={onOperations}
          onClose={() => setActorToDelete(null)}
        />
      ) : null}
    </section>
  );
}
