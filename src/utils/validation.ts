// ─── Input Validation Helpers ───────────────────────────────

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !email.trim()) return 'Email is required.';
  if (!re.test(email.trim())) return 'Enter a valid email address.';
  return null;
};

export const validatePassword = (password) => {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
};

export const validateRequired = (value, fieldName = 'This field') => {
  if (!value || !String(value).trim()) return `${fieldName} is required.`;
  return null;
};

export const validatePrice = (value) => {
  if (!value && value !== 0) return 'Price is required.';
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return 'Enter a valid price.';
  return null;
};

export const validateStock = (value) => {
  if (!value && value !== 0) return 'Stock is required.';
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) return 'Enter a valid stock quantity.';
  return null;
};

export const validatePositiveNumber = (value, fieldName = 'Value') => {
  if (!value && value !== 0) return `${fieldName} is required.`;
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return `${fieldName} must be greater than 0.`;
  return null;
};

// Returns { isValid, errors }
export const validateLoginForm = ({ email, password }: { email: string; password: string }) => {
  const errors: Record<string, string> = {};
  const emailErr = validateEmail(email);
  const passErr = validatePassword(password);
  if (emailErr) errors.email = emailErr;
  if (passErr) errors.password = passErr;
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateRegisterForm = ({ name, email, password }: { name: string; email: string; password: string }) => {
  const errors: Record<string, string> = {};
  const nameErr = validateRequired(name, 'Name');
  const emailErr = validateEmail(email);
  const passErr = validatePassword(password);
  if (nameErr) errors.name = nameErr;
  if (emailErr) errors.email = emailErr;
  if (passErr) errors.password = passErr;
  return { isValid: Object.keys(errors).length === 0, errors };
};
