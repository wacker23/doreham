'use client';

import { useState, useRef } from 'react';
import type { UiLanguage, VenueFormData } from '../lib/types';

type Props = {
  lang: UiLanguage;
  initialData: Partial<VenueFormData>;
  onNext: (data: { photo_files: File[] }) => void;
  onBack: () => void;
};

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE_MB = 5;

export function PhotosStep({ lang, initialData, onNext, onBack }: Props) {
  const [files, setFiles] = useState<File[]>(initialData.photo_files ?? []);
  const [previews, setPreviews] = useState<string[]>(() =>
    (initialData.photo_files ?? []).map((f) => URL.createObjectURL(f))
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelected(newFiles: FileList | null) {
    if (!newFiles) return;
    setError(null);

    const filesArray = Array.from(newFiles);
    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const f of filesArray) {
      if (files.length + validFiles.length >= MAX_PHOTOS) {
        setError(
          lang === 'ko'
            ? `사진은 최대 ${MAX_PHOTOS}장까지 업로드 가능합니다.`
            : `You can upload up to ${MAX_PHOTOS} photos.`
        );
        break;
      }

      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(
          lang === 'ko'
            ? `파일이 너무 큽니다. ${MAX_FILE_SIZE_MB}MB 이하로 올려주세요.`
            : `File is too large. Maximum ${MAX_FILE_SIZE_MB}MB per photo.`
        );
        continue;
      }

      if (!f.type.startsWith('image/')) {
        setError(
          lang === 'ko'
            ? '이미지 파일만 업로드 가능합니다.'
            : 'Only image files are allowed.'
        );
        continue;
      }

      validFiles.push(f);
      newPreviews.push(URL.createObjectURL(f));
    }

    setFiles([...files, ...validFiles]);
    setPreviews([...previews, ...newPreviews]);

    // Reset file input so user can re-select same file if needed
    if (inputRef.current) inputRef.current.value = '';
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles(files.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext({ photo_files: files });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '가게 사진' : 'Venue photos'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '가게 분위기가 잘 드러나는 사진을 올려주세요. (선택)'
          : 'Show off your space. (optional but recommended)'}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="file-input"
        id="photo-upload"
      />

      <div className="photos-grid">
        {previews.map((preview, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <div key={i} className="photo-tile">
            <img src={preview} alt={`Venue photo ${i + 1}`} />
            <button
              type="button"
              className="remove-btn"
              onClick={() => removePhoto(i)}
              aria-label={lang === 'ko' ? '사진 삭제' : 'Remove photo'}
            >
              ×
            </button>
            {i === 0 && (
              <span className="cover-badge">
                {lang === 'ko' ? '대표 사진' : 'Cover'}
              </span>
            )}
          </div>
        ))}

        {files.length < MAX_PHOTOS && (
          <label htmlFor="photo-upload" className="upload-tile">
            <span className="upload-icon">+</span>
            <span className="upload-text">
              {lang === 'ko' ? '사진 추가' : 'Add photo'}
            </span>
          </label>
        )}
      </div>

      <div className="info">
        {lang === 'ko' ? (
          <>
            <span>{files.length} / {MAX_PHOTOS}장</span>
            <span>파일당 최대 {MAX_FILE_SIZE_MB}MB · JPG, PNG, WebP</span>
          </>
        ) : (
          <>
            <span>{files.length} / {MAX_PHOTOS} photos</span>
            <span>Max {MAX_FILE_SIZE_MB}MB per file · JPG, PNG, WebP</span>
          </>
        )}
      </div>

      {error && <span className="err">{error}</span>}

      <div className="hint-box">
        <div className="hint-title">
          {lang === 'ko' ? '💡 좋은 사진을 위한 팁' : '💡 Tips for great photos'}
        </div>
        <ul>
          <li>
            {lang === 'ko'
              ? '첫 번째 사진이 대표 사진으로 표시됩니다.'
              : 'First photo becomes your cover image.'}
          </li>
          <li>
            {lang === 'ko'
              ? '자연광에서 촬영한 사진이 잘 나옵니다.'
              : 'Natural lighting makes photos pop.'}
          </li>
          <li>
            {lang === 'ko'
              ? '외관, 내부 분위기, 시그니처 메뉴를 모두 담아주세요.'
              : 'Include exterior, interior, and signature items.'}
          </li>
        </ul>
      </div>

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="submit" className="btn-next">
          {lang === 'ko' ? '다음 →' : 'Next →'}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .file-input { display: none; }
        .photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; }
        .photo-tile { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: var(--paper-2); }
        .photo-tile img { width: 100%; height: 100%; object-fit: cover; }
        .remove-btn { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 50%; background: rgba(30, 34, 48, 0.8); color: #fff; border: 0; font-size: 18px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
        .remove-btn:hover { background: var(--ink); }
        .cover-badge { position: absolute; bottom: 8px; left: 8px; background: var(--persimmon); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; }
        .upload-tile { aspect-ratio: 1; border: 2px dashed var(--ink-12); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: border-color 0.15s, background 0.15s; color: var(--ink-60); font-size: 14px; font-weight: 500; }
        .upload-tile:hover { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.03); color: var(--persimmon); }
        .upload-icon { font-size: 32px; line-height: 1; font-weight: 300; }
        .info { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink-60); margin-bottom: 12px; }
        .err { display: block; margin-bottom: 12px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .hint-box { background: var(--paper-2); border-radius: 12px; padding: 16px 18px; margin-bottom: 24px; }
        .hint-title { font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .hint-box ul { margin: 0; padding-left: 20px; }
        .hint-box li { font-size: 13.5px; color: var(--ink-60); line-height: 1.6; }
        .actions { margin-top: 20px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        @media (max-width: 480px) { .photos-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </form>
  );
}