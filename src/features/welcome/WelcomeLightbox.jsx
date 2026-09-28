"use client";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

export default function WelcomeLightbox({ index, slides, close }) {
  return (
    <Lightbox
      open
      index={index}
      slides={slides}
      close={close}
      plugins={[Zoom]}
      controller={{ closeOnBackdropClick: true, closeOnEscape: true }}
      labels={{ Lightbox: "TriggerFeed product screenshots" }}
      animation={{ fade: 0, swipe: 0, navigation: 0 }}
      zoom={{ maxZoomPixelRatio: 3 }}
      carousel={{ imageFit: "contain" }}
    />
  );
}
