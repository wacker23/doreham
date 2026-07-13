'use client';

import { useState, useRef } from 'react';
import type { UiLanguage, VenueFormData, MenuItem } from '../lib/types';

type Props = {
  lang: UiLanguage;
  initialData: Partial<VenueFormData>;
  onNext: (data: { menu_items: MenuItem[] }) => void;
  onBack: () => void;
  skipStep: boolean;   // true if category doesn't need menu (auto-advance)
};

const MAX_FILE_SIZE_MB = 3;

export function MenuItemsStep({ lang, initialData, onNext, onBack, skipStep }: Props) {
  const [items, setItems] = useState<MenuItem[]>(initialData.menu_items ?? []);
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state for adding/editing one item
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formIsSignature, setFormIsSignature] = useState(false);
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-advance if category doesn't need menu
  if (skipStep) {
    return (
      <div className="skip-notice">
        <p>
          {lang === 'ko'
            ? '이 업종은 메뉴 항목이 필요하지 않습니다.'
            : 'This category does not need menu items.'}
        </p>
        <div className="actions">
          <button type="button" className="btn-back" onClick={onBack}>
            {lang === 'ko' ? '← 이전' : '← Back'}
          </button>
          <button
            type="button"
            className="btn-next"
            onClick={() => onNext({ menu_items: [] })}
          >
            {lang === 'ko' ? '다음 →' : 'Next →'}
          </button>
        </div>

        <style jsx>{`
          .skip-notice { text-align: center; padding: 40px 20px; }
          .skip-notice p { color: var(--ink-60); font-size: 16px; margin-bottom: 32px; }
          .actions { display: flex; justify-content: space-between; gap: 12px; }
          .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
          .btn-back:hover { background: var(--ink); color: var(--paper); }
          .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; }
          .btn-next:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        `}</style>
      </div>
    );
  }

  function resetForm() {
    setFormName('');
    setFormNameEn('');
    setFormDescription('');
    setFormPrice('');
    setFormIsSignature(false);
    if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
    setFormPhotoFile(null);
    setFormPhotoPreview(null);
    setFormError(null);
    setEditingIndex(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(index: number) {
    const item = items[index];
    setFormName(item.name);
    setFormNameEn(item.name_en ?? '');
    setFormDescription(item.description ?? '');
    setFormPrice(item.price_won?.toString() ?? '');
    setFormIsSignature(item.is_signature);
    if (item.photo_file) {
      setFormPhotoFile(item.photo_file);
      setFormPhotoPreview(URL.createObjectURL(item.photo_file));
    } else {
      setFormPhotoFile(null);
      setFormPhotoPreview(null);
    }
    setEditingIndex(index);
    setShowForm(true);
  }

  function handlePhotoSelected(file: File | null) {
    if (!file) return;
    setFormError(null);

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFormError(
        lang === 'ko'
          ? `파일이 너무 큽니다. ${MAX_FILE_SIZE_MB}MB 이하로 올려주세요.`
          : `File too large. Max ${MAX_FILE_SIZE_MB}MB.`
      );
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFormError(
        lang === 'ko' ? '이미지 파일만 업로드 가능합니다.' : 'Only image files allowed.'
      );
      return;
    }

    if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
    setFormPhotoFile(file);
    setFormPhotoPreview(URL.createObjectURL(file));
  }

  function saveItem() {
    if (!formName.trim()) {
      setFormError(lang === 'ko' ? '메뉴 이름을 입력해주세요.' : 'Enter the menu item name.');
      return;
    }

    const newItem: MenuItem = {
      name: formName.trim(),
      name_en: formNameEn.trim() || undefined,
      description: formDescription.trim() || undefined,
      price_won: formPrice ? parseInt(formPrice, 10) : undefined,
      is_signature: formIsSignature,
      photo_file: formPhotoFile ?? undefined,
    };

    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = newItem;
      setItems(updated);
    } else {
      setItems([...items, newItem]);
    }

    resetForm();
    setShowForm(false);
  }

  function removeItem(index: number) {
    const item = items[index];
    if (item.photo_file) {
      // Revoke any preview URL if one was made
    }
    setItems(items.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext({ menu_items: items });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '메뉴 · 시그니처 상품' : 'Menu items'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '퀘스트에서 참여자들이 함께 시도할 수 있는 메뉴를 추가해주세요.'
          : 'Add items that Doreham groups can try together during quests.'}
      </p>

      <div className="items-list">
        {items.length === 0 && !showForm && (
          <div className="empty">
            <p>
              {lang === 'ko'
                ? '아직 등록된 메뉴가 없습니다.'
                : 'No menu items yet.'}
            </p>
          </div>
        )}

        {items.map((item, i) => (
          <div key={i} className="item-card">
            {item.photo_file && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={URL.createObjectURL(item.photo_file)}
                alt={item.name}
                className="item-photo"
              />
            )}
            <div className="item-info">
              <div className="item-name-row">
                <span className="item-name">{item.name}</span>
                {item.is_signature && (
                  <span className="sig-badge">
                    {lang === 'ko' ? '⭐ 시그니처' : '⭐ Signature'}
                  </span>
                )}
              </div>
              {item.name_en && <span className="item-name-en">{item.name_en}</span>}
              {item.description && <p className="item-desc">{item.description}</p>}
              {item.price_won && (
                <span className="item-price">
                  ₩{item.price_won.toLocaleString()}
                </span>
              )}
            </div>
            <div className="item-actions">
              <button
                type="button"
                className="btn-item-edit"
                onClick={() => openEditForm(i)}
              >
                {lang === 'ko' ? '수정' : 'Edit'}
              </button>
              <button
                type="button"
                className="btn-item-remove"
                onClick={() => removeItem(i)}
              >
                {lang === 'ko' ? '삭제' : 'Remove'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="add-form">
          <h3>
            {editingIndex !== null
              ? (lang === 'ko' ? '메뉴 수정' : 'Edit item')
              : (lang === 'ko' ? '메뉴 추가' : 'Add menu item')}
          </h3>

          <div className="field">
            <label>{lang === 'ko' ? '메뉴 이름' : 'Item name'}</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={lang === 'ko' ? '예: 카페라떼' : 'e.g. Café Latte'}
              className="input"
              maxLength={80}
            />
          </div>

          <div className="field">
            <label>
              {lang === 'ko' ? '영어 이름 (선택)' : 'English name (optional)'}
            </label>
            <input
              type="text"
              value={formNameEn}
              onChange={(e) => setFormNameEn(e.target.value)}
              placeholder="e.g. Café Latte"
              className="input"
              maxLength={80}
            />
          </div>

          <div className="field">
            <label>{lang === 'ko' ? '설명 (선택)' : 'Description (optional)'}</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={lang === 'ko' ? '메뉴에 대한 간단한 설명' : 'Brief description'}
              className="input textarea"
              rows={2}
              maxLength={200}
            />
          </div>

          <div className="row">
            <div className="field flex-1">
              <label>{lang === 'ko' ? '가격 (원)' : 'Price (₩)'}</label>
              <input
                type="number"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="5000"
                className="input"
                min="0"
                step="500"
              />
            </div>
            <div className="field signature-field">
              <label className="sig-toggle">
                <input
                  type="checkbox"
                  checked={formIsSignature}
                  onChange={(e) => setFormIsSignature(e.target.checked)}
                />
                <span>{lang === 'ko' ? '⭐ 시그니처 메뉴' : '⭐ Signature item'}</span>
              </label>
            </div>
          </div>

          <div className="field">
            <label>{lang === 'ko' ? '사진 (선택)' : 'Photo (optional)'}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handlePhotoSelected(e.target.files?.[0] ?? null)}
              className="file-input-visible"
            />
            {formPhotoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={formPhotoPreview} alt="Preview" className="photo-preview" />
            )}
          </div>

          {formError && <span className="err">{formError}</span>}

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              {lang === 'ko' ? '취소' : 'Cancel'}
            </button>
            <button type="button" className="btn-save" onClick={saveItem}>
              {editingIndex !== null
                ? (lang === 'ko' ? '수정 완료' : 'Save changes')
                : (lang === 'ko' ? '추가' : 'Add')}
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button type="button" className="btn-add-item" onClick={openAddForm}>
          + {lang === 'ko' ? '메뉴 추가' : 'Add menu item'}
        </button>
      )}

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="submit" className="btn-next" disabled={showForm}>
          {lang === 'ko' ? '다음 →' : 'Next →'}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }
        .items-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .empty { text-align: center; padding: 32px 20px; color: var(--ink-60); font-size: 14px; }
        .item-card { display: flex; gap: 12px; padding: 12px; background: #fff; border: 1px solid var(--ink-12); border-radius: 12px; align-items: center; }
        .item-photo { width: 70px; height: 70px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
        .item-info { flex: 1; min-width: 0; }
        .item-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .item-name { font-weight: 700; font-size: 15px; color: var(--ink); }
        .sig-badge { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
        .item-name-en { display: block; font-size: 13px; color: var(--ink-60); margin-top: 2px; }
        .item-desc { font-size: 13px; color: var(--ink-60); margin: 4px 0; line-height: 1.4; }
        .item-price { font-weight: 700; font-size: 14px; color: var(--jade); }
        .item-actions { display: flex; flex-direction: column; gap: 6px; }
        .btn-item-edit, .btn-item-remove { background: transparent; border: 1px solid var(--ink-12); padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .btn-item-edit:hover { background: var(--ink); color: var(--paper); }
        .btn-item-remove { color: var(--persimmon); }
        .btn-item-remove:hover { background: var(--persimmon); color: #fff; border-color: var(--persimmon); }
        .btn-add-item { width: 100%; background: var(--paper-2); border: 2px dashed var(--ink-12); padding: 14px; border-radius: 12px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink-60); cursor: pointer; margin-bottom: 20px; transition: border-color 0.15s, color 0.15s; }
        .btn-add-item:hover { border-color: var(--persimmon); color: var(--persimmon); }
        .add-form { background: var(--paper-2); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .add-form h3 { font-family: var(--display); font-weight: 700; font-size: 18px; margin: 0 0 16px; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-weight: 600; font-size: 13px; color: var(--ink); margin-bottom: 6px; }
        .input { width: 100%; padding: 10px 14px; border: 1px solid var(--ink-12); border-radius: 10px; background: #fff; font-family: var(--body); font-size: 14px; outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: var(--persimmon); }
        .textarea { resize: vertical; min-height: 60px; }
        .file-input-visible { font-size: 13px; }
        .photo-preview { display: block; margin-top: 10px; max-width: 140px; max-height: 140px; border-radius: 10px; object-fit: cover; }
        .row { display: flex; gap: 12px; align-items: flex-end; }
        .flex-1 { flex: 1; }
        .signature-field { flex: 1; }
        .sig-toggle { display: flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; user-select: none; padding-bottom: 8px; }
        .sig-toggle input { accent-color: var(--persimmon); cursor: pointer; }
        .err { display: block; margin-bottom: 12px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
        .btn-cancel { background: transparent; border: 1px solid var(--ink-12); padding: 10px 20px; border-radius: 999px; font-weight: 600; font-size: 13px; cursor: pointer; }
        .btn-cancel:hover { background: var(--ink); color: var(--paper); }
        .btn-save { background: var(--persimmon); color: #fff; border: 0; padding: 10px 20px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; }
        .btn-save:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(255, 106, 61, 0.32); }
        .actions { margin-top: 20px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </form>
  );
}