/* Accessible form field generators */

import { esc, attr } from '../domain/formatters.js';

export function field({
  id,
  name,
  label,
  value = '',
  type = 'text',
  required = false,
  hint = '',
  error = '',
  maxlength = null,
  min = null,
  max = null,
  placeholder = '',
  disabled = false
}) {
  const fieldId = id || `field-${name}`;
  const hintId = hint ? `${fieldId}-hint` : '';
  const errorId = error ? `${fieldId}-error` : '';
  const describedBy = [hintId, errorId].filter(Boolean).join(' ');

  return `
    <div class="form-group" id="group-${fieldId}">
      <label for="${fieldId}" class="form-label ${required ? 'form-label-required' : ''}">
        ${esc(label)}
      </label>
      <input
        type="${attr(type)}"
        id="${fieldId}"
        name="${attr(name)}"
        value="${attr(value)}"
        class="form-input"
        ${placeholder ? `placeholder="${attr(placeholder)}"` : ''}
        ${required ? 'required' : ''}
        ${disabled ? 'disabled' : ''}
        ${maxlength ? `maxlength="${maxlength}"` : ''}
        ${min !== null ? `min="${min}"` : ''}
        ${max !== null ? `max="${max}"` : ''}
        ${error ? 'aria-invalid="true"' : ''}
        ${describedBy ? `aria-describedby="${describedBy}"` : ''}
      >
      ${hint ? `<span id="${hintId}" class="form-hint">${esc(hint)}</span>` : ''}
      ${error ? `<span id="${errorId}" class="form-error" role="alert">${esc(error)}</span>` : ''}
    </div>
  `;
}

export function textarea({
  id,
  name,
  label,
  value = '',
  required = false,
  hint = '',
  error = '',
  rows = 3,
  maxlength = null,
  placeholder = '',
  disabled = false
}) {
  const fieldId = id || `field-${name}`;
  const hintId = hint ? `${fieldId}-hint` : '';
  const errorId = error ? `${fieldId}-error` : '';
  const describedBy = [hintId, errorId].filter(Boolean).join(' ');

  return `
    <div class="form-group" id="group-${fieldId}">
      <label for="${fieldId}" class="form-label ${required ? 'form-label-required' : ''}">
        ${esc(label)}
      </label>
      <textarea
        id="${fieldId}"
        name="${attr(name)}"
        rows="${rows}"
        class="form-textarea"
        ${placeholder ? `placeholder="${attr(placeholder)}"` : ''}
        ${required ? 'required' : ''}
        ${disabled ? 'disabled' : ''}
        ${maxlength ? `maxlength="${maxlength}"` : ''}
        ${error ? 'aria-invalid="true"' : ''}
        ${describedBy ? `aria-describedby="${describedBy}"` : ''}
      >${esc(value)}</textarea>
      ${hint ? `<span id="${hintId}" class="form-hint">${esc(hint)}</span>` : ''}
      ${error ? `<span id="${errorId}" class="form-error" role="alert">${esc(error)}</span>` : ''}
    </div>
  `;
}

export function select({
  id,
  name,
  label,
  options = [],
  selected = '',
  required = false,
  hint = '',
  error = '',
  disabled = false
}) {
  const fieldId = id || `field-${name}`;
  const hintId = hint ? `${fieldId}-hint` : '';
  const errorId = error ? `${fieldId}-error` : '';
  const describedBy = [hintId, errorId].filter(Boolean).join(' ');

  const optionsHtml = options.map((opt) => {
    const val = typeof opt === 'object' ? opt.value : opt;
    const txt = typeof opt === 'object' ? opt.label : opt;
    const isSelected = String(val) === String(selected);
    return `<option value="${attr(val)}" ${isSelected ? 'selected' : ''}>${esc(txt)}</option>`;
  }).join('');

  return `
    <div class="form-group" id="group-${fieldId}">
      <label for="${fieldId}" class="form-label ${required ? 'form-label-required' : ''}">
        ${esc(label)}
      </label>
      <select
        id="${fieldId}"
        name="${attr(name)}"
        class="form-select"
        ${required ? 'required' : ''}
        ${disabled ? 'disabled' : ''}
        ${error ? 'aria-invalid="true"' : ''}
        ${describedBy ? `aria-describedby="${describedBy}"` : ''}
      >
        ${optionsHtml}
      </select>
      ${hint ? `<span id="${hintId}" class="form-hint">${esc(hint)}</span>` : ''}
      ${error ? `<span id="${errorId}" class="form-error" role="alert">${esc(error)}</span>` : ''}
    </div>
  `;
}
