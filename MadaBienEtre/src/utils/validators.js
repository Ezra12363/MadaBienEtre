// src/utils/validators.js
// Vérifie la robustesse du mot de passe utilisée par validators.password.
const validatePassword = (value) => {
  const errors = [];
  const password = typeof value === 'string' ? value : '';

  if (password.length < 8) {
    errors.push('au moins 8 caractères');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('une lettre majuscule');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('une lettre minuscule');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('un chiffre');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validators = {
  required: (value) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return 'Ce champ est requis';
    }
    return null;
  },
  email: (value) => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regex.test(value)) {
      return 'Email invalide';
    }
    return null;
  },
  phone: (value) => {
    const regex = /^(\+261|0)[0-9]{9}$/;
    if (!regex.test(value)) {
      return 'Numéro de téléphone invalide';
    }
    return null;
  },
  minLength: (min) => (value) => {
    if (!value || value.length < min) {
      return `Minimum ${min} caractères`;
    }
    return null;
  },
  maxLength: (max) => (value) => {
    if (value && value.length > max) {
      return `Maximum ${max} caractères`;
    }
    return null;
  },
  password: (value) => {
    const { isValid, errors } = validatePassword(value);
    if (!isValid) {
      return `Mot de passe faible: ${errors.join(', ')}`;
    }
    return null;
  },
  match: (field, label) => (value, formValues) => {
    if (value !== formValues[field]) {
      return `${label} ne correspond pas`;
    }
    return null;
  },
  number: (value) => {
    if (isNaN(value) || value === '') {
      return 'Doit être un nombre';
    }
    return null;
  },
  min: (min) => (value) => {
    if (parseFloat(value) < min) {
      return `Minimum ${min}`;
    }
    return null;
  },
  max: (max) => (value) => {
    if (parseFloat(value) > max) {
      return `Maximum ${max}`;
    }
    return null;
  },
};

export const validate = (values, rules) => {
  const errors = {};
  Object.keys(rules).forEach((field) => {
    const fieldRules = Array.isArray(rules[field]) ? rules[field] : [rules[field]];
    for (const rule of fieldRules) {
      const error = typeof rule === 'function' 
        ? rule(values[field], values) 
        : null;
      if (error) {
        errors[field] = error;
        break;
      }
    }
  });
  return errors;
};