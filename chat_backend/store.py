"""Tiny in-memory ChatKit Store.

`chatkit.store` ships only the abstract `Store` — no in-memory impl — so
we provide one. Everything lives in three dicts; nothing persists across
restarts. Fine for a demo, not for prod.
"""

from __future__ import annotations

from typing import Any

from chatkit.store import NotFoundError, Store
from chatkit.types import Attachment, Page, ThreadItem, ThreadMetadata

#: Maximum stored items per thread. The agent's context window already
#: only loads the last ~20 items per turn, but without a cap the store
#: itself grows unbounded across long sessions. Capping at 40 keeps
#: roughly the last 10 user/assistant exchanges plus their tool-call
#: items in memory (tool calls and widget items count too, so we leave
#: a little headroom above the strict 2 × 10).
MAX_ITEMS_PER_THREAD = 40


def _trim(items: list[ThreadItem]) -> list[ThreadItem]:
    if len(items) <= MAX_ITEMS_PER_THREAD:
        return items
    return items[-MAX_ITEMS_PER_THREAD:]


class InMemoryStore(Store[Any]):
    def __init__(self) -> None:
        self._threads: dict[str, ThreadMetadata] = {}
        self._items: dict[str, list[ThreadItem]] = {}        # thread_id → items in order
        self._attachments: dict[str, Attachment] = {}

    # ---- threads ---------------------------------------------------------

    async def load_thread(self, thread_id: str, context: Any) -> ThreadMetadata:
        try:
            return self._threads[thread_id]
        except KeyError as exc:
            raise NotFoundError(f"thread {thread_id} not found") from exc

    async def save_thread(self, thread: ThreadMetadata, context: Any) -> None:
        self._threads[thread.id] = thread
        self._items.setdefault(thread.id, [])

    async def load_threads(
        self, limit: int, after: str | None, order: str, context: Any
    ) -> Page[ThreadMetadata]:
        threads = list(self._threads.values())
        threads.sort(key=lambda t: getattr(t, "created_at", t.id), reverse=(order != "asc"))
        return _paginate(threads, after, limit, key=lambda t: t.id)

    async def delete_thread(self, thread_id: str, context: Any) -> None:
        self._threads.pop(thread_id, None)
        self._items.pop(thread_id, None)

    # ---- items -----------------------------------------------------------

    async def add_thread_item(self, thread_id: str, item: ThreadItem, context: Any) -> None:
        items = self._items.setdefault(thread_id, [])
        items.append(item)
        self._items[thread_id] = _trim(items)

    async def save_item(self, thread_id: str, item: ThreadItem, context: Any) -> None:
        items = self._items.setdefault(thread_id, [])
        for i, existing in enumerate(items):
            if existing.id == item.id:
                items[i] = item
                return
        items.append(item)
        self._items[thread_id] = _trim(items)

    async def load_item(self, thread_id: str, item_id: str, context: Any) -> ThreadItem:
        for item in self._items.get(thread_id, []):
            if item.id == item_id:
                return item
        raise NotFoundError(f"item {item_id} not found in {thread_id}")

    async def load_thread_items(
        self, thread_id: str, after: str | None, limit: int, order: str, context: Any
    ) -> Page[ThreadItem]:
        items = list(self._items.get(thread_id, []))
        if order != "asc":
            items.reverse()
        return _paginate(items, after, limit, key=lambda i: i.id)

    async def delete_thread_item(self, thread_id: str, item_id: str, context: Any) -> None:
        items = self._items.get(thread_id, [])
        self._items[thread_id] = [i for i in items if i.id != item_id]

    # ---- attachments -----------------------------------------------------

    async def save_attachment(self, attachment: Attachment, context: Any) -> None:
        self._attachments[attachment.id] = attachment

    async def load_attachment(self, attachment_id: str, context: Any) -> Attachment:
        try:
            return self._attachments[attachment_id]
        except KeyError as exc:
            raise NotFoundError(f"attachment {attachment_id} not found") from exc

    async def delete_attachment(self, attachment_id: str, context: Any) -> None:
        self._attachments.pop(attachment_id, None)


def _paginate(items, after, limit, *, key):
    if after is not None:
        for i, it in enumerate(items):
            if key(it) == after:
                items = items[i + 1 :]
                break
    page = items[: max(limit, 0)]
    has_more = len(items) > len(page)
    next_after = key(page[-1]) if (has_more and page) else None
    return Page(data=page, has_more=has_more, after=next_after)
