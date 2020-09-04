var acorn = require("acorn");

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

  function commentForLocation(loc)
  {
      let comment = comments.find(c => (c.loc.line || c.loc.end.line) + 1 == loc.start.line)

      if (!comment) return undefined

      return comment.text.trim()
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

  function schemaToTable(schema)
  {
      if (!schema) return "No Schema"

      headers = ["Name", "Type", "Default", "Description"]
      lines = ["|" + headers.map(h => ` ${h} `).join("|") + "|"]
      lines.push("|" + headers.map(h => `---`).join("|") + "|")

      let schemaProps = schema.value.properties

      if (schemaProps.some(p => p.key.name === 'default' || p.key.name === 'type'))
      {
        schemaProps = [{key: "[Single Property Component]", value: schema.value, loc: schema.loc}]
      }

      for (let prop of schemaProps)
      {
          let entry = {}
          for (let p of prop.value.properties)
          {
              entry[p.key.name] = p.value
          }

          row = []

          row.push(prop.key.name)
          row.push(entry.type ? entry.type.value : inferType(entry))
          row.push(entry.default ? entry.default.value : "")
          row.push(commentForLocation(prop.loc))

          lines.push("| " + row.join(" | ") + " |")
      }

      return lines.join("\n")
  }

  function handleTopLevelExpression(expression)
  {
      if (!expression || !expression.callee || !expression.callee.property) return
      if (!/register(Component|System|ComponentSystem)/.test(expression.callee.property.name)) return

      let type = /register(Component|System|ComponentSystem)/.exec(expression.callee.property.name)[1]

      let componentName = expression.arguments[0].value

      console.log(`Registering component "${componentName}"`)

      let schema = expression.arguments[1].properties.find(p => p.key.name == 'schema')

      let schemaTable = schemaToTable(schema)

      let docstring = commentForLocation(expression.loc) || ""

      console.log("It has", docstring)

      output = []
      output.push(`
# ${type} \`${componentName}\`

**Source code:** [${filename}:${expression.loc.start.line}](${sourceBaseURL}${filename}#L${expression.loc.start.line})

${docstring}

## Schema

${schemaTable}
  `)

      return output.join("\n")
  }

  return p.body.map(e => handleTopLevelExpression(e.expression)).filter(e => !!e).join("\n\n")
}

module.exports = {parseToMarkdown}
