'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

type Props = {
  profile: { id: string; photo_url: string | null; display_name: string };
  lang: 'en' | 'ko';
  onClose: () => void;
  onSaved: () => void;
};

const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.85;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    img.onload = () => {
      // Compute new dimensions preserving aspect ratio
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_DIMENSION;
          width = MAX_DIMENSION;
        } else {
          width = (width / height) * MAX_DIMENSION;
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas to blob failed'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));

    reader.readAsDataURL(file);
  });
}

export function EditPhotoModal({ profile, lang, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(profile.photo_url);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      setError(lang === 'ko' ? '파일 크기가 너무 큽니다 (최대 10MB).' : 'File too large (max 10MB).');
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(selected.type)) {
      setError(lang === 'ko' ? 'JPEG, PNG 또는 WebP 이미지만 사용할 수 있습니다.' : 'Only JPEG, PNG, or WebP images allowed.');
      return;
    }

    setError(null);
    setFile(selected);

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(selected);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      // Compress
      const compressed = await compressImage(file);

      // Upload path: user_id/timestamp.jpg
      const timestamp = Date.now();
      const filePath = `${profile.id}/${timestamp}.jpg`;

      // Try to delete old photo if it exists
      if (profile.photo_url) {
        try {
          // Extract old path from URL
          const url = new URL(profile.photo_url);
          const parts = url.pathname.split('/profile-photos/');
          if (parts[1]) {
            await supabase.storage.from('profile-photos').remove([parts[1]]);
          }
        } catch (e) {
          // Silent fail — old photo delete not critical
          console.warn('Could not delete old photo:', e);
        }
      }

      // Upload new
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, compressed, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      // Update profile
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ photo_url: urlData.publicUrl })
        .eq('id', profile.id);

      if (dbError) throw new Error(dbError.message);

      setUploading(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!confirm(lang === 'ko' ? '프로필 사진을 삭제하시겠습니까?' : 'Remove profile photo?')) return;

    setUploading(true);
    setError(null);

    try {
      // Delete file
      if (profile.photo_url) {
        try {
          const url = new URL(profile.photo_url);
          const parts = url.pathname.split('/profile-photos/');
          if (parts[1]) {
            await supabase.storage.from('profile-photos').remove([parts[1]]);
          }
        } catch (e) {
          console.warn('Could not delete photo file:', e);
        }
      }

      // Update DB
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ photo_url: null })
        .eq('id', profile.id);

      if (dbError) throw new Error(dbError.message);

      setUploading(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 className="modal-title">{lang === 'ko' ? '프로필 사진' : 'Profile photo'}</h2>

        <div className="preview-wrap">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="preview" />
          ) : (
            <div className="preview preview-fallback">
              {profile.display_name[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div className="upload-actions">
          <button
            type="button"
            className="btn-choose"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            📷 {lang === 'ko' ? '사진 선택' : 'Choose photo'}
          </button>
          {profile.photo_url && (
            <button
              type="button"
              className="btn-remove"
              onClick={handleRemove}
              disabled={uploading}
            >
              🗑 {lang === 'ko' ? '삭제' : 'Remove'}
            </button>
          )}
        </div>

        <p className="hint">
          {lang === 'ko'
            ? 'JPEG, PNG 또는 WebP • 최대 10MB • 자동으로 800x800으로 리사이즈됩니다.'
            : 'JPEG, PNG or WebP • Max 10MB • Auto-resized to 800x800.'}
        </p>

        {error && <div className="error-msg">{error}</div>}

        <div className="actions">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={uploading}>
            {lang === 'ko' ? '취소' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn-save"
            onClick={handleUpload}
            disabled={uploading || !file}
          >
            {uploading
              ? (lang === 'ko' ? '업로드 중…' : 'Uploading…')
              : (lang === 'ko' ? '저장' : 'Save')}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop { position: fixed; inset: 0; background: rgba(30, 34, 48, 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; backdrop-filter: blur(4px); }
        .modal-card { background: #fff; border-radius: 20px; width: 100%; max-width: 480px; padding: 32px; position: relative; max-height: 90vh; overflow-y: auto; }
        .close-btn { position: absolute; top: 12px; right: 12px; background: transparent; border: 0; font-size: 28px; color: var(--ink-60); cursor: pointer; width: 40px; height: 40px; border-radius: 50%; font-weight: 300; }
        .close-btn:hover { background: var(--paper-2); color: var(--ink); }
        .modal-title { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 24px; color: var(--ink); letter-spacing: -0.02em; text-align: center; }
        .preview-wrap { display: flex; justify-content: center; margin-bottom: 24px; }
        .preview { width: 180px; height: 180px; border-radius: 50%; object-fit: cover; border: 4px solid var(--paper-2); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .preview-fallback { background: var(--persimmon); color: #fff; display: grid; place-items: center; font-family: var(--display); font-weight: 800; font-size: 72px; }
        .upload-actions { display: flex; gap: 10px; justify-content: center; margin-bottom: 12px; }
        .btn-choose { background: var(--paper-2); border: 1px solid var(--ink-12); padding: 10px 20px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; cursor: pointer; color: var(--ink); }
        .btn-choose:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-remove { background: transparent; border: 1px solid rgba(255, 106, 61, 0.3); color: var(--persimmon); padding: 10px 20px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; cursor: pointer; }
        .btn-remove:hover:not(:disabled) { background: var(--persimmon); color: #fff; }
        .hint { color: var(--ink-60); font-size: 13px; text-align: center; margin: 0 0 20px; }
        .error-msg { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
        .actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; padding-top: 20px; border-top: 1px solid var(--ink-12); }
        .btn-cancel { background: transparent; border: 1px solid var(--ink-12); padding: 10px 20px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; cursor: pointer; color: var(--ink); }
        .btn-cancel:hover { background: var(--paper-2); }
        .btn-save { background: var(--persimmon); color: #fff; border: 0; padding: 10px 24px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 14px; cursor: pointer; }
        .btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-save:disabled, .btn-cancel:disabled, .btn-choose:disabled, .btn-remove:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
