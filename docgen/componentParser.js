var acorn = require("acorn");
var escodegen = require('escodegen');

function parseToMarkdown(txt, {filename, sourceBaseURL})
{
  comments = []

  function handleComment(block, text, start, end, loc) {
      comments.push({block, text, start, end, loc})
  }

  var p = acorn.Parser.parse(txt, {
      ecmaVersion: 2020,
      locations: true,
      onComment: handleComment,
      sourceType: 'module',
  });

  function formatCommentForTable(comment)
  {
    return comment ? comment.replace(/\n\n/gm, "<br><br>").replace(/\n/gm, " ") : "";
  }

  function commentForLocation(loc)
  {
      let comment = []

      let startLine = loc.start.line
      let currentComment

      do {
        currentComment = comments.find(c => (c.loc.line || c.loc.end.line) + 1 == startLine)

        if (currentComment)
        {
          comment.push(currentComment.text.replace(/\s/, ""))
          startLine = currentComment.loc.line || c.loc.start.line
        }

      } while(currentComment)

      if (comment.length == 0) return undefined

      comment = comment.reverse()

      return comment.join("\n")
  }

  function inferType(entry)
  {
      if (!entry.default) return "unknown"

      if (typeof entry.default.value === 'boolean' || typeof entry.default.value === 'number')
      {
          return typeof entry.default.value
      }

      if (entry.default.properties) return "array"

      return 'string'
  }

  const codeGenOpts = {
    format: {
      newline: ' ',
      indent: {style: ''},
    }
  }
  function formatSchemaDefault(entry, type)
  {
    switch (type)
    {
      case 'float':
      case 'number':
      case 'string':
      case 'color':
      case 'bool':
      case 'int':
      case 'boolean':
      case 'map':
      case 'selector':
        return entry.default.value
      case 'vec2':
      case 'vec3':
      case 'vec4':
        try {
          return entry.default.arguments.map(a => a.raw).join("&nbsp;&nbsp;")
        } catch (e) {
          return escodegen.generate(entry.default, codeGenOpts)
        }

      default:
        return escodegen.generate(entry.default, codeGenOpts)
    }
  }

  function schemaToTable(schema)
  {
      if (!schema) return

      headers = ["Property", "Type", "Default", "Description"]
      lines = ["|" + headers.map(h => ` ${h} `).join("|") + "|"]
      lines.push("|" + headers.map(h => `---`).join("|") + "|")

      let schemaProps = schema.value.properties

      if (schemaProps.some(p => p.key.name === 'default' || (p.key.name === 'type' && !p.value.properties)))
      {
        schemaProps = [{key: {name:"[Single Property Component]"}, value: schema.value, loc: schema.loc}]
      }

      for (let prop of schemaProps)
      {
          let entry = {}
          for (let p of prop.value.properties)
          {
              entry[p.key.name] = p.value
          }

          row = []

          let type = entry.type ? entry.type.value : inferType(entry)
          row.push(prop.key.name)
          row.push(type)
          row.push(entry.default ? formatSchemaDefault(entry, type) : "")

          let comment = formatCommentForTable(commentForLocation(prop.loc))

          row.push(comment)

          lines.push("| " + row.join(" | ") + " |")
      }

      return lines.join("\n")
  }

  function stringifyParam(p)
  {
    return txt.slice(p.start, p.end)
  }

  function functionsToTable(functions) {
    if (functions.length === 0) return ""

    headers = ["Signature", "Description"]

    lines = ["|" + headers.map(h => ` ${h} `).join("|") + "|"]
    lines.push("|" + headers.map(h => `---`).join("|") + "|")

    for (let func of functions)
    {
      let comment = commentForLocation(func.loc)
      if (!comment) continue

      let row = []

      comment = formatCommentForTable(comment)

      row.push(`${func.key.name} \`(${func.value.params.map(p => stringifyParam(p)).join(", ")})\``)

      row.push(comment)

      lines.push("| " + row.join(" | ") + " |")
    }

    if (lines.length === 2) return ""

    return lines.join("\n")
  }

  function handleClassDeclaration(expression)
  {
    let comment = commentForLocation(expression.id.loc)
    // if (!comment) continue
    // comment = formatCommentForTable(comment)

    let className = expression.id.name

    let funcString = functionsToTable(expression.body.body.filter(p => p.value.type === 'FunctionExpression'))

    let output = []
    output.push(`
## Class \`${className}\` [(${filename}:${expression.loc.start.line})](${sourceBaseURL}${filename}#L${expression.loc.start.line})

${comment}
`)

    if (funcString)
    {
      output.push(`
### ${className} Methods

${funcString}
`)
    }

    output.push("\n---\n")

    return output.join("\n")
  }

  function handleTopLevelExpression(expression)
  {
      if (!expression) return ""
      if (expression.type === 'ClassDeclaration') { return handleClassDeclaration(expression); }
      if (expression.type === 'ExportNamedDeclaration' &&  expression.declaration && expression.declaration.type === 'ClassDeclaration') return handleClassDeclaration(expression.declaration)
      if (!expression.callee || !expression.callee.property) return
      if (!/register(Component|System|ComponentSystem|Shader)/.test(expression.callee.property.name)) return

      let type = /register(Component|System|ComponentSystem|Shader)\b/.exec(expression.callee.property.name)[1]

      let componentName = expression.arguments[0].value

      // console.log(`Registering component "${componentName}"`)

      let schema = expression.arguments[1].properties.find(p => p.key.name == 'schema')

      let schemaTable = schemaToTable(schema)

      let docstring = commentForLocation(expression.loc) || ""

      let funcString = functionsToTable(expression.arguments[1].properties.filter(p => p.value.type === 'FunctionExpression'))

      // console.log("It has", docstring)

      output = []
      output.push(`
<a name="${componentName}"></a>
## ${type} \`${componentName}\` [(${filename}:${expression.loc.start.line})](${sourceBaseURL}${filename}#L${expression.loc.start.line})

${docstring}
  `)

      if (schemaTable)
      {
        output.push(`
### ${componentName} Schema

${schemaTable}
`)
      }

      if (funcString)
      {
        output.push(`
### ${componentName} Methods

${funcString}
`)
      }

      output.push("\n---\n")

      return output.join("\n")
  }

  return `
<a name="${filename}"></a>
# ${filename}

` + p.body.map(e => handleTopLevelExpression(e.expression || e)).filter(e => !!e).join("\n\n")
}

module.exports = {parseToMarkdown}
