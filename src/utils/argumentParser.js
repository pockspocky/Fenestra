/**
 * Backend argument parser for terminal commands
 * Provides parseArguments function and command schemas for backend use
 */

// Error type constants for argument parsing
const PARSE_ERROR_TYPES = {
  SWITCH_AFTER_POSITIONAL: 'SWITCH_AFTER_POSITIONAL',
  UNKNOWN_SWITCH: 'UNKNOWN_SWITCH',
  MISSING_VALUE: 'MISSING_VALUE',
  TOO_FEW_ARGUMENTS: 'TOO_FEW_ARGUMENTS',
  TOO_MANY_ARGUMENTS: 'TOO_MANY_ARGUMENTS',
  INVALID_SWITCH: 'INVALID_SWITCH'
};

/**
 * Create a standardized error response object
 */
function createParseError(type, message, position = null, context = null) {
  const error = {
    type: type,
    message: message
  };
  
  if (position !== null) {
    error.position = position;
  }
  
  if (context !== null) {
    error.context = context;
  }
  
  return error;
}

/**
 * Parse command line arguments into switches and positionals
 * @param {string[]} tokens - Array of argument tokens
 * @param {Object} schema - Command schema with switches and positionals definitions
 * @returns {Object} Parse result with success, switches, positionals, and error
 */
function parseArguments(tokens, schema = null) {
  // Initialize result structure
  const result = {
    success: true,
    switches: {},
    positionals: [],
    error: null
  };

  // State machine: PARSING_SWITCHES -> PARSING_POSITIONALS
  const STATE = {
    PARSING_SWITCHES: 'PARSING_SWITCHES',
    PARSING_POSITIONALS: 'PARSING_POSITIONALS'
  };
  
  let state = STATE.PARSING_SWITCHES;
  let i = 0;

  // Handle empty input - but still need to validate positionals later
  if (!tokens || tokens.length === 0) {
    // Don't return early - we need to validate positionals
    // Just skip the parsing loop
  } else {

  // Helper function to check if a switch requires a value
  function switchRequiresValue(switchName) {
    if (!schema || !schema.switches) {
      return false; // Without schema, assume boolean
    }
    
    // Check both short and long forms
    for (const [key, def] of Object.entries(schema.switches)) {
      if (key === switchName || def.long === switchName) {
        return def.type === 'value';
      }
    }
    
    return false; // Default to boolean if not in schema
  }

  // Helper function to check if a switch is valid in the schema
  function isSwitchValid(switchName) {
    if (!schema || !schema.switches) {
      return true; // Without schema, all switches are valid
    }
    
    // Check both short and long forms
    for (const [key, def] of Object.entries(schema.switches)) {
      if (key === switchName || def.long === switchName) {
        return true;
      }
    }
    
    return false;
  }

  // Helper function to get the long form of a switch (for mapping short to long)
  function getLongForm(switchName) {
    if (!schema || !schema.switches) {
      return switchName; // Without schema, return as-is
    }
    
    // Check if this is a short form that has a long form
    for (const [key, def] of Object.entries(schema.switches)) {
      if (key === switchName && def.long) {
        return def.long;
      }
    }
    
    return switchName; // Return original if no long form found
  }

  // Helper function to get valid switches for error messages
  function getValidSwitches() {
    if (!schema || !schema.switches) {
      return [];
    }
    
    const switches = [];
    for (const [key, def] of Object.entries(schema.switches)) {
      if (def.long) {
        switches.push(`-${key}, --${def.long}`);
      } else {
        switches.push(`-${key}`);
      }
    }
    
    return switches;
  }

  while (i < tokens.length) {
    const token = tokens[i];

    // Detect switch tokens (starting with - or --)
    // Special case: single "-" is not a valid switch
    const isSwitch = token.startsWith('-') && token.length > 1;
    const isSingleDash = token === '-';

    if (isSingleDash) {
      // Single "-" is invalid
      result.success = false;
      result.error = createParseError(
        PARSE_ERROR_TYPES.INVALID_SWITCH,
        'Invalid switch format: "-"',
        i
      );
      return result;
    }

    if (isSwitch) {
      // Check if we've already started parsing positionals
      if (state === STATE.PARSING_POSITIONALS) {
        // Error: switch after positional
        result.success = false;
        result.error = createParseError(
          PARSE_ERROR_TYPES.SWITCH_AFTER_POSITIONAL,
          'Switches must appear before positional arguments',
          i
        );
        return result;
      }

      // Parse the switch
      if (token.startsWith('--')) {
        // Long form switch (e.g., --verbose, --all)
        const switchName = token.substring(2);
        
        if (switchName.length === 0) {
          // Just "--" by itself - could be used as separator in future
          result.success = false;
          result.error = createParseError(
            PARSE_ERROR_TYPES.INVALID_SWITCH,
            'Invalid switch format: "--"',
            i
          );
          return result;
        }

        // Validate switch against schema
        if (schema && schema.switches && !isSwitchValid(switchName)) {
          result.success = false;
          result.error = createParseError(
            PARSE_ERROR_TYPES.UNKNOWN_SWITCH,
            `Unknown switch: --${switchName}`,
            i,
            {
              switchName: `--${switchName}`,
              validSwitches: getValidSwitches()
            }
          );
          return result;
        }

        // Check if this switch requires a value
        if (switchRequiresValue(switchName)) {
          // Value switch - consume next token as value
          i++; // Move to next token
          
          if (i >= tokens.length) {
            // No value provided
            result.success = false;
            result.error = createParseError(
              PARSE_ERROR_TYPES.MISSING_VALUE,
              `Switch --${switchName} requires a value`,
              i - 1,
              {
                switchName: `--${switchName}`
              }
            );
            return result;
          }
          
          const nextToken = tokens[i];
          
          // Check if next token is a switch (which would be an error)
          if (nextToken.startsWith('-') && nextToken.length > 1) {
            result.success = false;
            result.error = createParseError(
              PARSE_ERROR_TYPES.MISSING_VALUE,
              `Switch --${switchName} requires a value, got switch ${nextToken} instead`,
              i - 1,
              {
                switchName: `--${switchName}`,
                received: nextToken
              }
            );
            return result;
          }
          
          // Store switch with its value
          result.switches[switchName] = nextToken;
          i++;
        } else {
          // Boolean flag - store as true
          result.switches[switchName] = true;
          i++;
        }
      } else {
        // Short form switch (e.g., -a, -v)
        const switchChars = token.substring(1);
        
        if (switchChars.length === 0) {
          // Just "-" by itself
          result.success = false;
          result.error = createParseError(
            PARSE_ERROR_TYPES.INVALID_SWITCH,
            'Invalid switch format: "-"',
            i
          );
          return result;
        }

        // Parse each character as a separate switch
        // Note: For combined switches like -abc, only the last one can be a value switch
        for (let j = 0; j < switchChars.length; j++) {
          const switchChar = switchChars[j];
          const isLastChar = j === switchChars.length - 1;
          
          // Validate switch against schema
          if (schema && schema.switches && !isSwitchValid(switchChar)) {
            result.success = false;
            result.error = createParseError(
              PARSE_ERROR_TYPES.UNKNOWN_SWITCH,
              `Unknown switch: -${switchChar}`,
              i,
              {
                switchName: `-${switchChar}`,
                validSwitches: getValidSwitches()
              }
            );
            return result;
          }
          
          // Check if this switch requires a value
          if (switchRequiresValue(switchChar)) {
            // Value switch
            if (!isLastChar) {
              // Value switch must be the last character in combined form
              result.success = false;
              result.error = createParseError(
                PARSE_ERROR_TYPES.INVALID_SWITCH,
                `Value switch -${switchChar} must be the last character in combined switch ${token}`,
                i,
                {
                  switchName: `-${switchChar}`,
                  token: token
                }
              );
              return result;
            }
            
            // Consume next token as value
            i++; // Move to next token
            
            if (i >= tokens.length) {
              // No value provided
              result.success = false;
              result.error = createParseError(
                PARSE_ERROR_TYPES.MISSING_VALUE,
                `Switch -${switchChar} requires a value`,
                i - 1,
                {
                  switchName: `-${switchChar}`
                }
              );
              return result;
            }
            
            const nextToken = tokens[i];
            
            // Check if next token is a switch (which would be an error)
            if (nextToken.startsWith('-') && nextToken.length > 1) {
              result.success = false;
              result.error = createParseError(
                PARSE_ERROR_TYPES.MISSING_VALUE,
                `Switch -${switchChar} requires a value, got switch ${nextToken} instead`,
                i - 1,
                {
                  switchName: `-${switchChar}`,
                  received: nextToken
                }
              );
              return result;
            }
            
            // Map short form to long form and store switch with its value
            const longForm = getLongForm(switchChar);
            result.switches[longForm] = nextToken;
            // Also store short form for backward compatibility
            if (longForm !== switchChar) {
              result.switches[switchChar] = nextToken;
            }
          } else {
            // Boolean flag - store as true
            // Map short form to long form
            const longForm = getLongForm(switchChar);
            result.switches[longForm] = true;
            // Also store short form for backward compatibility
            if (longForm !== switchChar) {
              result.switches[switchChar] = true;
            }
          }
        }
        i++;
      }
    } else {
      // Not a switch - it's a positional argument
      state = STATE.PARSING_POSITIONALS;
      result.positionals.push(token);
      i++;
    }
  }
  } // End of parsing loop

  // Check for help switches before validating positionals
  if (result.switches.help || result.switches.h) {
    // Help switches bypass positional validation
    return result;
  }

  // Validate positional argument count against schema
  if (schema && schema.positionals) {
    const positionalCount = result.positionals.length;
    const min = schema.positionals.min !== undefined ? schema.positionals.min : 0;
    const max = schema.positionals.max !== undefined ? schema.positionals.max : Infinity;
    
    if (positionalCount < min) {
      // Too few positional arguments
      result.success = false;
      result.error = createParseError(
        PARSE_ERROR_TYPES.TOO_FEW_ARGUMENTS,
        `Too few arguments: expected at least ${min}, got ${positionalCount}`,
        null,
        {
          expected: min,
          received: positionalCount,
          names: schema.positionals.names || []
        }
      );
      return result;
    }
    
    if (positionalCount > max) {
      // Too many positional arguments
      result.success = false;
      result.error = createParseError(
        PARSE_ERROR_TYPES.TOO_MANY_ARGUMENTS,
        `Too many arguments: expected at most ${max}, got ${positionalCount}`,
        null,
        {
          expected: max,
          received: positionalCount,
          names: schema.positionals.names || []
        }
      );
      return result;
    }
  }

  return result;
}

// Command schemas for backend use
const commandSchemas = {
  'create-picture': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      },
      'o': {
        long: 'opacity',
        type: 'value',
        description: 'Set window opacity (0.0-1.0)',
        default: 1.0
      }
    },
    positionals: {
      min: 2,
      max: 3,
      names: ['windowID', 'imagePath', 'fitMode']
    }
  },
  'set-picture': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 2,
      max: 3,
      names: ['windowID', 'imagePath', 'fitMode']
    }
  },
  'set-fit-mode': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 2,
      max: 2,
      names: ['windowID', 'fitMode']
    }
  },
  'info': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 1,
      max: 1,
      names: ['windowID']
    }
  },
  'show': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 1,
      max: 1,
      names: ['windowID']
    }
  },
  'hide': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 1,
      max: 1,
      names: ['windowID']
    }
  },
  'get-title': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 1,
      max: 1,
      names: ['windowID']
    }
  },
  'set-title': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 2,
      max: Infinity,
      names: ['windowID', 'title']
    }
  },
  'list': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      },
      'a': {
        long: 'all',
        type: 'boolean',
        description: 'Show all windows including hidden ones'
      },
      'v': {
        long: 'verbose',
        type: 'boolean',
        description: 'Show detailed window information'
      }
    },
    positionals: {
      min: 0,
      max: 0,
      names: []
    }
  },
  'ls': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      },
      'a': {
        long: 'all',
        type: 'boolean',
        description: 'Show all windows including hidden ones'
      },
      'v': {
        long: 'verbose',
        type: 'boolean',
        description: 'Show detailed window information'
      }
    },
    positionals: {
      min: 0,
      max: 0,
      names: []
    }
  },
  'create-content': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      },
      'o': {
        long: 'opacity',
        type: 'value',
        description: 'Set window opacity (0.0-1.0)',
        default: 1.0
      },
      't': {
        long: 'transparent',
        type: 'boolean',
        description: 'Make window transparent',
        default: false
      }
    },
    positionals: {
      min: 2,
      max: 5,
      names: ['windowID', 'type', 'path', 'blurAmount', 'shouldBlur']
    }
  },
  'reload-html': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 2,
      max: 2,
      names: ['windowID', 'htmlPath']
    }
  },
  'create-lens': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      },
      'o': {
        long: 'opacity',
        type: 'value',
        description: 'Set lens opacity (0.0-1.0)',
        default: 1.0
      }
    },
    positionals: {
      min: 2,
      max: 4,
      names: ['lensID', 'targetWindowID', 'width', 'height']
    }
  },
  'destroy-lens': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 1,
      max: 1,
      names: ['lensID']
    }
  },
  'list-lens': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 0,
      max: 0,
      names: []
    }
  },
  'lens-list': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 0,
      max: 0,
      names: []
    }
  },
  'lens-info': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 1,
      max: 1,
      names: ['lensID']
    }
  },
  'save-window': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 1,
      max: 2,
      names: ['windowID', 'filename']
    }
  },
  'restore-window': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 1,
      max: Infinity,
      names: ['filePath']
    }
  },
  'list-saved': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 0,
      max: 0,
      names: []
    }
  },
  'delete-saved': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      },
      'c': {
        long: 'confirm',
        type: 'boolean',
        description: 'Skip confirmation prompt'
      }
    },
    positionals: {
      min: 1,
      max: 1,
      names: ['filename']
    }
  },
  'cd': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 0,
      max: Infinity,
      names: ['directory']
    }
  },
  'pwd': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 0,
      max: 0,
      names: []
    }
  },
  'config': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 0,
      max: Infinity,
      names: ['subcommand', 'key', 'value']
    }
  },
  'clear': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 0,
      max: 0,
      names: []
    }
  },
  'dir': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      },
      'a': {
        long: 'all',
        type: 'boolean',
        description: 'Show hidden files and directories'
      }
    },
    positionals: {
      min: 0,
      max: Infinity,
      names: ['directory']
    }
  },
  'getwindows': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      },
      'v': {
        long: 'verbose',
        type: 'boolean',
        description: 'Show detailed window information'
      },
      'a': {
        long: 'all',
        type: 'boolean',
        description: 'Show all windows including hidden ones'
      }
    },
    positionals: {
      min: 0,
      max: 0,
      names: []
    }
  },
  'update-blur': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 2,
      max: 2,
      names: ['windowID', 'blurAmount']
    }
  },
  'set-size': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 3,
      max: 3,
      names: ['windowID', 'width', 'height']
    }
  },
  'set-position': {
    switches: {
      'h': {
        long: 'help',
        type: 'boolean',
        description: 'Show help for this command'
      }
    },
    positionals: {
      min: 3,
      max: 3,
      names: ['windowID', 'x', 'y']
    }
  }
};

export { parseArguments, commandSchemas, PARSE_ERROR_TYPES, createParseError };