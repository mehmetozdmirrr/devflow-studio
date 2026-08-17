import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../components/ConfirmDialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <ConfirmDialog
        open={open}
        title="Delete item"
        body="This cannot be undone."
        destructive
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

describe("ConfirmDialog", () => {
  it("is not rendered when closed", () => {
    render(
      <ConfirmDialog open={false} title="t" body="b" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders with dialog semantics and focuses the cancel button first", async () => {
    render(
      <ConfirmDialog
        open
        title="Delete item"
        body="This cannot be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(screen.getByText("Cancel")).toHaveFocus());
  });

  it("calls onCancel when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Delete item"
        body="body"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("traps Tab focus within the dialog", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog open title="Delete item" body="body" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    const cancelButton = screen.getByText("Cancel");
    const confirmButton = screen.getByText("Confirm");
    await waitFor(() => expect(cancelButton).toHaveFocus());

    await user.tab();
    expect(confirmButton).toHaveFocus();

    await user.tab();
    expect(cancelButton).toHaveFocus();
  });

  it("restores focus to the triggering element after closing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByText("Open dialog");
    await user.click(trigger);

    await waitFor(() => expect(screen.getByText("Cancel")).toHaveFocus());
    await user.keyboard("{Escape}");

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
