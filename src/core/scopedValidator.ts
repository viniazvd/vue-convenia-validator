import { Vue as VueComponent } from 'vue-property-decorator'

import FieldBag from './fieldBag'
import Field from './field'

import RuleContainer from './ruleContainer'
import { is } from '../utils'
import '../rules'

import {
  ValidatorOptionsObject,
  ValidatorOptions,
  NormalizedRule,
  ValidationRule,
  FormValidation,
  FieldValidation,
  FieldFlags,
  ValidatorOptionsFn,
} from '../types'


// ScopedValidor specific types

export interface VM extends VueComponent { [dataName: string]: any }
export type ScopedFormValidation = { [scope: string]: FormValidation }
export type FormTemplate = ScopedFormValidation | FormValidation

export type FormValidationFlags
  = { [scope: string]: { [fieldName: string]: FieldFlags } }
  | { [fieldName: string]: FieldFlags }


export default class ScopedValidator {
  private _vm: VM

  public fields: FieldBag
  public scopes: string[] = []

  private _options: ValidatorOptionsObject = {}
  public validations: FormValidationFlags = {}


  constructor (vm: VueComponent) {
    this._vm = vm
    this.fields = new FieldBag()

    vm.$nextTick(() => {
      if (this._vm.$options.validatorOptions)
        this.options = this._vm.$options.validatorOptions

      if (this._vm.$options.validations)
        this.init(this._vm.$options.validations)
    })
  }

  get options () {
    return this._options
  }

  set options (options: any) {
    this._options = is(options, 'Function')
      ? options(this._vm)
      : { ...options }
  }

  /**
   * This two following functions are responsible for bootstraping
   * the ScopedValidation class with the given validation options.
   * The public init function exists to ensure that whenever we're
   * bootstraping the ScopedValidator class, the DOM will be accessible
   * through the _vm.
   *
   * @param template - The form validations template object.
   * @returns {void}
   *
   * @author Erik Isidore
   */

  public init (template: FormTemplate): void {
    this._vm.$nextTick(this.__init.bind(this, template))
  }

  private __init (template: FormTemplate): void {
    this.scopes = Object.keys(template)
    this.fields.items = this.initFields(template)
    this.validations = this.mapValidations()
  }

  /**
   * Receives a FormTemplate object and maps the fields validation rules
   * in it to populate the `fields` instance property with Field instances.
   *
   * @param {FormTemplate} template - The form or forms validation object.
   * @returns {void}
   *
   * @author Erik Isidore
   */

  initFields (template: FormTemplate): Field[] {
    const mapField = (name: string, rules: FieldValidation, scope?: string): Field => {
      const fieldOptions = {
        name,
        rules,
        scope,
        vm: this._vm,
        el: this.getFieldEl(name, scope),
        value: scope ? this._vm[scope][name] : this._vm[name],
      }

      return new Field(fieldOptions)
    }

    // This will map each form scope name to an array of Field instances,
    // producing an Array of Field arrays, crazy rite? Each field will
    // have its respective scope assigned to it.
    const scopes = this.scopes.map((scope: string) => {
      const formScope: FormValidation = template[scope] as FormValidation

      return Object.keys(formScope)
        .map(fieldName => mapField(fieldName, formScope[fieldName], scope))
    })

    return Array.prototype.concat([], ...scopes)
  }

  /**
   * Generetes the validation flags object based on the form scopes.
   *
   * @returns {FormValidationFlags}
   *
   * @author Erik Isidore
   */

  mapValidations (): FormValidationFlags {
    const mapFlags = (scope?: string) => this.fields.all(scope)
      .reduce((acc, field: Field) => ({ ...acc, [field.name]: field.flags }), {})

    const mapFormScopes = (acc: object, scope: string) => ({
      ...acc,
      [scope]: mapFlags(scope)
    })

    return this.scopes.length > 1
      ? this.scopes.reduce(mapFormScopes, { })
      : mapFlags()
  }

  /**
   * Receives a fieldName and optionally it's scope and returns the HTML
   * Element corresponding to that field in the DOM.
   *
   * @param {String} fieldName - The name of the field
   * @param {String} scope? - Optional form scope.
   * @returns {Element} - The first matching element found in the component DOM.
   *
   * @author Erik Isidore
   */

  getFieldEl (fieldName: string, scope?: string): Element {
    const fieldQuery = scope
      ? `form[name="${scope}"] [name="${fieldName}"]`
      : `[name="${fieldName}"]`

    const fields: NodeList = this._vm.$el.querySelectorAll(fieldQuery)

    if (process.env.NODE_ENV !== 'production' && !fields.length)
      console.warn(`CeeValidate: Field "${fieldName}" could not be found in the DOM`)

    return <Element>fields[0]
  }

  /**
   * @param {String} fieldName -
   * @param {String} scope? -
   * @returns {void}
   *
   * @author Erik Isidore
   */

  validate (fieldName: string, scope?: string): boolean {
    const field = this.fields.get(fieldName, scope)

    // Field doesn't exist, return false (invalid field)
    if (!field) return false

    const mapErrors = ({ ruleName, args }: NormalizedRule): string => {
      const rule: ValidationRule = RuleContainer.getRule(ruleName)
      const hasError = !rule.validate.apply(null, [field.value, ...(args || [])])
      const errorMessage = rule.message

      return hasError ? errorMessage : ''
    }

    const fieldErrors: string[] = field.rules
      .map(mapErrors)
      .filter(message => !!message)

    field.setFlag('errors', fieldErrors)
    field.setFlag('valid', !fieldErrors.length)

    return !fieldErrors.length
  }

  /**
   * Executes the validate() method on all Field instances.
   *
   * @param {String} scope? -
   * @returns {void}
   *
   * @author Erik Isidore
   */

  validateAll (scope?: string): boolean {
    const fieldFlags = this.fields.all(scope)
      .map((field: Field) => field.validate())

    const isValid = fieldFlags.every(isValid => !!isValid)
    this.options = { ...(this.options || {}), noListeners: false }

    return isValid
  }

  /**
   * Resets all of the fields validation flags.
   *
   * @param {String} scope? -
   * @returns {void}
   *
   * @author Erik Isidore
   */

  reset (scope?: string): void {
    this.fields.all(scope).forEach((field: Field) => field.reset())
  }

  /**
   * Attaches a new field to the validator.
   *
   * @param {}
   * @returns {void}
   *
   * @author Erik Isidore
   */

  attach (field: { name: string, rules: string, scope: string }): void {
    const newField: Field = new Field({
      vm: this._vm,
      name: field.name,
      rules: field.rules,
      scope: field.scope,
      el: this.getFieldEl(field.name, field.scope),
      value: field.scope ? this._vm[field.scope][field.name] : this._vm[field.name]
    })

    this.fields.push(newField)
    this.validations = this.mapValidations()
  }

  /**
   * Detaches an existing field from the validator.
   *
   * @param {String} field - The name of the field
   * @param {String} scope? - Optional scope of the field
   * @returns {void}
   *
   * @author Erik Isidore
   */

  detach (field: string, scope?: string): void {
    this.fields.remove(field, scope)
    this.validations = this.mapValidations()
  }

  /**
   * Sets the rule of a field and validate it if it has changed.
   *
   * @param {Object<name: string, scope: string>} field - Object with name
   * and scope of the field.
   * @param {FieldValidation} rules - The rules to be set in the field
   * @returns {void}
   */
  setFieldRule (field: { name: string, scope: string }, rules: FieldValidation): void {
    const fieldInstance : Field | undefined = this.fields.get(field.name, field.scope)
    if (!fieldInstance) return

    fieldInstance.setRule(rules)

    if (fieldInstance.flags.changed) fieldInstance.validate()
  }
}
