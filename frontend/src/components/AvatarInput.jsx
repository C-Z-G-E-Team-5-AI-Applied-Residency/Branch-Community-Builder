// Avatar picker with in-app circular crop: choose a file, adjust the crop in
// a dialog, and the parent gets back a square PNG File ready for the existing
// upload endpoint. Used by sign-up onboarding and profile edit.
import { useEffect, useState } from "react";
import Cropper from "react-easy-crop";

const OUTPUT_SIZE = 512; // square px — a 512² PNG stays well under the 2 MB cap

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}

async function cropToFile(src, area) {
  const img = await loadImage(src);
  const size = Math.min(OUTPUT_SIZE, Math.round(area.width));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")
    .drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new File([blob], "avatar.png", { type: "image/png" });
}

export default function AvatarInput({ currentSrc = null, onChange }) {
  const [rawSrc, setRawSrc] = useState(null); // object URL being cropped
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState(null);
  // object URL of a newly cropped pick, pending upload; null = nothing picked yet,
  // so the display below falls back to currentSrc. Separate from currentSrc so
  // "discard" can drop the pending pick without touching the saved picture.
  const [preview, setPreview] = useState(null);

  // Owns revocation: fires on every preview change (dropping the old URL) and
  // on unmount, so a pending pick never leaks its object URL either way.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function onPick(e) {
    const file = e.target.files[0];
    e.target.value = ""; // so re-picking the same file fires onChange again
    if (!file) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRawSrc(URL.createObjectURL(file));
  }

  function closeCropper() {
    URL.revokeObjectURL(rawSrc);
    setRawSrc(null);
  }

  async function onApply() {
    const file = await cropToFile(rawSrc, areaPixels);
    setPreview(URL.createObjectURL(file));
    onChange(file);
    closeCropper();
  }

  function onClear() {
    setPreview(null);
    onChange(null);
  }

  const displaySrc = preview || currentSrc;

  return (
    <div className="avatar-input">
      {displaySrc && <img className="avatar avatar-preview" src={displaySrc} alt="Profile preview" />}
      <label>
        Profile picture (optional)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onPick}
        />
      </label>
      {preview && (
        <button type="button" onClick={onClear}>
          Discard new photo
        </button>
      )}

      {rawSrc && (
        <div className="crop-backdrop">
          <div className="crop-dialog">
            <div className="crop-area">
              <Cropper
                image={rawSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, px) => setAreaPixels(px)}
              />
            </div>
            <label>
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <div className="crop-actions">
              <button type="button" onClick={closeCropper}>
                Cancel
              </button>{" "}
              <button type="button" className="btn-primary" onClick={onApply}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
