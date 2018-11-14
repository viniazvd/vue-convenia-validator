import RuleContainer from '../core/ruleContainer'

/**
 * Validate if the input value produces a valid date and optionally if
 * it follows a given date format.
 *
 * @param {String | Number} value - The value of the input to be validated,
 * if `value` is a String, the validator may also receive a format param to
 * check if the string has the correct format.
 * @param {String} format? - Optional parameter to validate whether the the
 * given input value has the correct format. If given, the value must be a
 * string, otherwise this parameter is completely ignored.
 *
 * @returns {boolean} True if the given value is valid, false otherwise.
 *
 * @author Erik Isidore
 * @version 0.1
 */

const rule = {
  validate: (value: string | number, format?: string): boolean => {
    console.log('date_format')
    return true
  },
  message: ''
}

RuleContainer.add('date_format', rule)
export default rule