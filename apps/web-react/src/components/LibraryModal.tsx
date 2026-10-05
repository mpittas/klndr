import type { ActivityTemplate } from "@klndr/core";

import { LibraryPanel } from "@/components/library/LibraryPanel";
import { Modal } from "@/components/Modal";
import { useLibrary } from "@/lib/library";

/**
 * The one dialog for managing activities and categories, opened from the activity palette, the category
 * picker (inside the block editor) or the phones' nav. The library mutations write their answers into the
 * cache, so the panel needs nothing forwarded to the planner (see `LibraryPanel`).
 */
export function LibraryModal({ templates }: { templates: ActivityTemplate[] }) {
  const { open, focus, request, hide } = useLibrary();

  return (
    <Modal open={open} title="Activities & categories" subtitle="Edit everything in one place." lg onClose={hide}>
      <div className="sm:min-h-[30rem]">
        <LibraryPanel key={request} focus={focus} templates={templates} />
      </div>
    </Modal>
  );
}
