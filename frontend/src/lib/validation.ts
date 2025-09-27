export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class Validator {
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      errors.push('Email is required');
    } else if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    } else if (email.length > 100) {
      errors.push('Email must be less than 100 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (!password) {
      errors.push('Password is required');
    } else {
      if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
      }
      if (!/(?=.*[a-z])/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/(?=.*[A-Z])/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/(?=.*\d)/.test(password)) {
        errors.push('Password must contain at least one number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateName(name: string): ValidationResult {
    const errors: string[] = [];
    const nameRegex = /^[a-zA-Z\s]+$/;

    if (!name) {
      errors.push('Name is required');
    } else {
      if (name.length < 2 || name.length > 50) {
        errors.push('Name must be between 2 and 50 characters');
      }
      if (!nameRegex.test(name)) {
        errors.push('Name can only contain letters and spaces');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validatePollQuestion(question: string): ValidationResult {
    const errors: string[] = [];
    const questionRegex = /^[a-zA-Z0-9\s\.,!?()'"-]+$/;

    if (!question) {
      errors.push('Poll question is required');
    } else {
      if (question.length < 10 || question.length > 500) {
        errors.push('Question must be between 10 and 500 characters');
      }
      if (!questionRegex.test(question)) {
        errors.push('Question contains invalid characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validatePollOptions(options: string[]): ValidationResult {
    const errors: string[] = [];

    if (!options || !Array.isArray(options)) {
      errors.push('Poll options are required');
      return { isValid: false, errors };
    }

    if (options.length < 2) {
      errors.push('Poll must have at least 2 options');
    }
    if (options.length > 10) {
      errors.push('Poll can have maximum 10 options');
    }

    // Check for empty options
    const nonEmptyOptions = options.filter(opt => opt.trim().length > 0);
    if (nonEmptyOptions.length < 2) {
      errors.push('Poll must have at least 2 non-empty options');
    }

    options.forEach((option, index) => {
      if (option.trim().length === 0) {
        errors.push(`Option ${index + 1} cannot be empty`);
      } else if (option.length > 200) {
        errors.push(`Option ${index + 1} must be less than 200 characters`);
      }
    });

    // Check for duplicates (case insensitive)
    const lowerCaseOptions = nonEmptyOptions.map(opt => opt.toLowerCase().trim());
    const uniqueOptions = new Set(lowerCaseOptions);
    if (uniqueOptions.size !== nonEmptyOptions.length) {
      errors.push('Poll options must be unique');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return input;

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[\\$'"]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static sanitizeOptions(options: string[]): string[] {
    return options.map(opt => this.sanitizeInput(opt)).filter(opt => opt.length > 0);
  }

  static validateObjectId(id: string): ValidationResult {
    const errors: string[] = [];
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;

    if (!id) {
      errors.push('ID is required');
    } else if (!objectIdRegex.test(id)) {
      errors.push('Invalid ID format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateUrl(url: string): ValidationResult {
    const errors: string[] = [];
    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

    if (!url) {
      errors.push('URL is required');
    } else if (!urlRegex.test(url)) {
      errors.push('Invalid URL format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Helper function for form validation
export const validateForm = (fields: { [key: string]: string | string[] }): ValidationResult => {
  const errors: string[] = [];

  Object.entries(fields).forEach(([key, value]) => {
    let result: ValidationResult;

    switch (key) {
      case 'email':
        result = Validator.validateEmail(value as string);
        break;
      case 'password':
        result = Validator.validatePassword(value as string);
        break;
      case 'name':
        result = Validator.validateName(value as string);
        break;
      case 'question':
        result = Validator.validatePollQuestion(value as string);
        break;
      case 'options':
        result = Validator.validatePollOptions(value as string[]);
        break;
      default:
        result = { isValid: true, errors: [] };
    }

    errors.push(...result.errors);
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Utility function for real-time validation feedback
export const getValidationClass = (isValid: boolean, isTouched: boolean) => {
  if (!isTouched) return '';
  return isValid ? 'valid' : 'invalid';
};