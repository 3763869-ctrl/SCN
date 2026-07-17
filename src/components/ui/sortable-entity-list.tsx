"use client";

import Link from "next/link";
import { GripVertical } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type SortableEntityItem = {
  href: string;
  id: string;
  meta: string;
  selected: boolean;
  title: string;
};

type SortableEntityListProps = {
  emptyMessage: string;
  items: SortableEntityItem[];
  saveOrderAction: (ids: string[]) => Promise<void>;
  sortByNameAction: () => Promise<void>;
};

export function SortableEntityList({
  emptyMessage,
  items,
  saveOrderAction,
  sortByNameAction,
}: SortableEntityListProps) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function moveItem(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      return;
    }

    setOrderedItems((currentItems) => {
      const draggedIndex = currentItems.findIndex((item) => item.id === draggedId);
      const targetIndex = currentItems.findIndex((item) => item.id === targetId);

      if (draggedIndex < 0 || targetIndex < 0) {
        return currentItems;
      }

      const nextItems = [...currentItems];
      const [draggedItem] = nextItems.splice(draggedIndex, 1);
      nextItems.splice(targetIndex, 0, draggedItem);

      return nextItems;
    });
  }

  function saveOrder() {
    startTransition(async () => {
      await saveOrderAction(orderedItems.map((item) => item.id));
      setMessage("Order saved.");
    });
  }

  function sortByName() {
    startTransition(async () => {
      await sortByNameAction();
      setMessage("Sorted by name.");
    });
  }

  if (!items.length) {
    return (
      <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="h-9 flex-1" disabled={isPending} onClick={saveOrder} variant="secondary">
          Save order
        </Button>
        <Button className="h-9 flex-1" disabled={isPending} onClick={sortByName} variant="secondary">
          Sort by name
        </Button>
      </div>
      {message ? <p className="text-xs font-medium text-muted-foreground">{message}</p> : null}
      <div className="space-y-2">
        {orderedItems.map((item) => (
          <div
            className={`grid grid-cols-[auto_1fr] items-stretch rounded-md border text-sm ${
              item.selected
                ? "border-accent bg-surface-muted"
                : "border-border bg-background"
            }`}
            draggable
            key={item.id}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => {
              event.preventDefault();
              moveItem(item.id);
            }}
            onDragStart={() => setDraggedId(item.id)}
          >
            <span className="grid cursor-grab place-items-center border-r border-border px-2 text-muted-foreground active:cursor-grabbing">
              <GripVertical className="h-4 w-4" />
            </span>
            <Link className="block px-3 py-3" href={item.href}>
              <span className="block font-semibold">{item.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{item.meta}</span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
