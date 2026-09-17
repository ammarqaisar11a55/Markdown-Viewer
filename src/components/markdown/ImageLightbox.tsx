import { X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { trapTab } from '@/components/ui/focus';

export interface LightboxImage {
  src: string;
  alt: string;
}

export interface ImageLightboxProps {
  image: LightboxImage;
  onClose: () => void;
}

/** Full-window image preview. Esc, the close button or a backdrop click close it. */
export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (dialogRef.current !== null) trapTab(event, dialogRef.current);
    };
    // Capture phase so global Escape handlers (reading mode) don't also fire.
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (previous?.isConnected === true) previous.focus({ preventScroll: true });
    };
  }, []);

  const label = image.alt.trim() === '' ? 'Image preview' : `Image preview: ${image.alt}`;

  return createPortal(
    <div
      className="md-lightbox"
      role="presentation"
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLImageElement)) onCloseRef.current();
      }}
    >
      <div
        ref={dialogRef}
        className="md-lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <button
          ref={closeRef}
          type="button"
          className="md-lightbox-close"
          aria-label="Close image preview"
          title="Close (Esc)"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={() => {
            onCloseRef.current();
          }}
        >
          <X aria-hidden="true" />
        </button>
        <figure className="md-lightbox-figure">
          <img className="md-lightbox-image" src={image.src} alt={image.alt} draggable={false} />
          {image.alt.trim() !== '' && (
            <figcaption className="md-lightbox-caption">{image.alt}</figcaption>
          )}
        </figure>
      </div>
    </div>,
    document.body,
  );
}
