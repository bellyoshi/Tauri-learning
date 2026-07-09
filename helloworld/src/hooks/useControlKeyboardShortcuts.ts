import { useEffect, useRef } from "react";
import { MediaType } from "../types";

export interface ControlKeyboardHandlers {
  mediaType: MediaType;
  onPageFirst: () => void;
  onPagePrev: () => void;
  onPageNext: () => void;
  onPageLast: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onRotateRight90: () => void;
  onDeleteCurrent?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function useControlKeyboardShortcuts(handlers: ControlKeyboardHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const current = handlersRef.current;
      const { mediaType } = current;

      switch (event.key) {
        case "Home":
          if (mediaType === "pdf") {
            event.preventDefault();
            current.onPageFirst();
          }
          break;
        case "End":
          if (mediaType === "pdf") {
            event.preventDefault();
            current.onPageLast();
          }
          break;
        case "ArrowLeft":
        case "PageUp":
          if (mediaType === "pdf") {
            event.preventDefault();
            current.onPagePrev();
          }
          break;
        case "ArrowRight":
        case "PageDown":
          if (mediaType === "pdf") {
            event.preventDefault();
            current.onPageNext();
          }
          break;
        case "+":
        case "=":
          if (mediaType !== "none") {
            event.preventDefault();
            current.onZoomIn();
          }
          break;
        case "-":
        case "_":
          if (mediaType !== "none") {
            event.preventDefault();
            current.onZoomOut();
          }
          break;
        case "0":
          if (mediaType !== "none") {
            event.preventDefault();
            current.onZoomReset();
          }
          break;
        case "r":
        case "R":
          if (mediaType === "pdf" || mediaType === "image") {
            event.preventDefault();
            current.onRotateRight90();
          }
          break;
        case "Delete":
          if (current.onDeleteCurrent) {
            event.preventDefault();
            current.onDeleteCurrent();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
