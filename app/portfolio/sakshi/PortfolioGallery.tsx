import Image from "next/image";

const images = [
  {
    src: "/portfolio/sakshi/image-01.jpg",
    title: "SEO & Analytics",
  },
  {
    src: "/portfolio/sakshi/image-02.jpg",
    title: "Content Strategy",
  },
  {
    src: "/portfolio/sakshi/image-03.jpg",
    title: "Editorial Growth",
  },
  {
    src: "/portfolio/sakshi/image-04.jpg",
    title: "Content & Publishing",
  },
  {
    src: "/portfolio/sakshi/image-05.jpg",
    title: "Digital Strategy",
  },
  {
    src: "/portfolio/sakshi/image-06.jpg",
    title: "Audience Growth",
  },
  {
    src: "/portfolio/sakshi/image-07.png",
    title: "Editorial Work",
  },
  {
    src: "/portfolio/sakshi/image-08.png",
    title: "SEO Performance",
  },
  {
    src: "/portfolio/sakshi/image-09.png",
    title: "Digital Content",
  },
];

export default function PortfolioGallery() {
  return (
    <section className="sx-gallery-wrapper">
      <div className="sx-gallery">
        {images.map((image, index) => (
          <a
            key={image.src}
            href={`#sx-image-${index}`}
            className="sx-gallery-item"
            aria-label={`Open ${image.title}`}
          >
            <Image
              src={image.src}
              alt={image.title}
              fill
              sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
              className="sx-gallery-image"
            />

            <div className="sx-gallery-overlay" />

            <div className="sx-gallery-info">
              <span>{image.title}</span>
              <strong>View ↗</strong>
            </div>
          </a>
        ))}
      </div>

      {images.map((image, index) => {
        const previousIndex =
          index === 0 ? images.length - 1 : index - 1;

        const nextIndex =
          index === images.length - 1 ? 0 : index + 1;

        return (
          <div
            key={`lightbox-${image.src}`}
            id={`sx-image-${index}`}
            className="sx-lightbox"
          >
            <div className="sx-lightbox-bg" />

            <div className="sx-lightbox-container">
              <a
                href="#sx-gallery"
                className="sx-lightbox-close"
                aria-label="Close image"
              >
                ×
              </a>

              <a
                href={`#sx-image-${previousIndex}`}
                className="sx-lightbox-prev"
                aria-label="Previous image"
              >
                ‹
              </a>

              <div className="sx-lightbox-image">
                <Image
                  src={image.src}
                  alt={image.title}
                  fill
                  sizes="90vw"
                  className="sx-lightbox-img"
                  priority={index === 0}
                />
              </div>

              <a
                href={`#sx-image-${nextIndex}`}
                className="sx-lightbox-next"
                aria-label="Next image"
              >
                ›
              </a>

              <div className="sx-lightbox-caption">
                <span>{image.title}</span>
                <b>
                  {index + 1} / {images.length}
                </b>
              </div>

              <div className="sx-lightbox-instruction">
                Use ‹ › to browse · × to close
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        .sx-gallery-wrapper {
          width: 100%;
          margin-top: 32px;
        }

        .sx-gallery {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .sx-gallery-item {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          background: #0b0b12;
          text-decoration: none;
          cursor: zoom-in;
        }

        .sx-gallery-image {
          object-fit: cover;
          transition:
            transform 0.5s ease,
            filter 0.5s ease;
        }

        .sx-gallery-item:hover .sx-gallery-image {
          transform: scale(1.06);
          filter: brightness(1.08);
        }

        .sx-gallery-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.9) 0%,
            rgba(0, 0, 0, 0.25) 55%,
            rgba(0, 0, 0, 0) 100%
          );
        }

        .sx-gallery-info {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 15px;
          z-index: 3;

          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;

          color: white;
          pointer-events: none;
        }

        .sx-gallery-info span {
          font-size: 13px;
          font-weight: 700;
        }

        .sx-gallery-info strong {
          padding: 7px 11px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.5);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: nowrap;
          backdrop-filter: blur(8px);
        }

        /* =========================
           SAME-PAGE LIGHTBOX
           ========================= */

        .sx-lightbox {
          position: fixed;
          inset: 0;
          z-index: 999999;

          display: none;
          align-items: center;
          justify-content: center;
        }

        .sx-lightbox:target {
          display: flex;
        }

        .sx-lightbox-bg {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.97);
          backdrop-filter: blur(18px);
        }

        .sx-lightbox-container {
          position: relative;
          z-index: 2;

          width: 100%;
          height: 100%;

          display: flex;
          align-items: center;
          justify-content: center;

          pointer-events: none;
        }

        .sx-lightbox-image {
          position: relative;
          width: min(1100px, 82vw);
          height: min(78vh, 800px);

          pointer-events: auto;
        }

        .sx-lightbox-img {
          object-fit: contain;
          user-select: none;
        }

        /* Close */

        .sx-lightbox-close {
          position: fixed;
          top: 22px;
          right: 24px;
          z-index: 20;

          width: 50px;
          height: 50px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;

          background: rgba(20, 20, 30, 0.9);
          color: white;

          font-size: 30px;
          line-height: 1;
          text-decoration: none;

          pointer-events: auto;

          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .sx-lightbox-close:hover {
          background: rgba(139, 92, 246, 0.9);
          transform: scale(1.05);
        }

        /* Previous */

        .sx-lightbox-prev,
        .sx-lightbox-next {
          position: fixed;
          top: 50%;
          z-index: 20;

          width: 54px;
          height: 54px;

          display: flex;
          align-items: center;
          justify-content: center;

          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;

          background: rgba(20, 20, 30, 0.9);
          color: white;

          font-size: 40px;
          line-height: 1;
          text-decoration: none;

          pointer-events: auto;

          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .sx-lightbox-prev {
          left: 24px;
          transform: translateY(-50%);
        }

        .sx-lightbox-next {
          right: 24px;
          transform: translateY(-50%);
        }

        .sx-lightbox-prev:hover,
        .sx-lightbox-next:hover {
          background: rgba(139, 92, 246, 0.9);
          transform: translateY(-50%) scale(1.06);
        }

        /* Caption */

        .sx-lightbox-caption {
          position: fixed;
          left: 50%;
          bottom: 22px;
          z-index: 20;

          transform: translateX(-50%);

          display: flex;
          align-items: center;
          gap: 14px;

          padding: 10px 16px;

          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;

          background: rgba(15, 15, 25, 0.9);
          color: white;

          font-size: 12px;
          white-space: nowrap;

          backdrop-filter: blur(12px);
        }

        .sx-lightbox-caption b {
          color: #a78bfa;
        }

        .sx-lightbox-instruction {
          position: fixed;
          left: 22px;
          bottom: 25px;
          z-index: 20;

          color: rgba(255, 255, 255, 0.45);
          font-size: 11px;
        }

        /* Tablet */

        @media (max-width: 900px) {
          .sx-gallery {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sx-lightbox-image {
            width: 86vw;
            height: 72vh;
          }
        }

        /* Mobile */

        @media (max-width: 600px) {
          .sx-gallery {
            grid-template-columns: 1fr;
          }

          .sx-lightbox-image {
            width: 94vw;
            height: 70vh;
          }

          .sx-lightbox-close {
            top: 12px;
            right: 12px;
            width: 44px;
            height: 44px;
          }

          .sx-lightbox-prev,
          .sx-lightbox-next {
            width: 44px;
            height: 44px;
          }

          .sx-lightbox-prev {
            left: 8px;
          }

          .sx-lightbox-next {
            right: 8px;
          }

          .sx-lightbox-instruction {
            display: none;
          }

          .sx-lightbox-caption {
            bottom: 14px;
          }
        }
      `}</style>
    </section>
  );
}