'use client';

export default function ClickGuard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-full min-h-full flex flex-col"
      onClickCapture={(e) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button');

        if (button) {
          if (button.dataset.processing === 'true') {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          button.dataset.processing = 'true';
          button.style.pointerEvents = 'none';

          setTimeout(() => {
            button.dataset.processing = 'false';
            button.style.pointerEvents = 'auto';
          }, 600);
        }
      }}
    >
      {children}
    </div>
  );
}