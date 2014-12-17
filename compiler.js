module.exports = Compiler;

function Compiler(node, opts) {
  this.opts = opts = opts || {};
  this.node = node;
}

Compiler.prototype.compile = function() {
  var ast = this.visit(this.node);
  return 'return ' + JSON.stringify(ast) + ';';
};

Compiler.prototype.visit = function(node) {
  if (!node || !node.type) return undefined;
  console.log('visit' + node.type);
  return this['visit' + node.type](node);
};

Compiler.prototype.visitCase = function(node) {
  return {
    type: 'switch',
    expression: node.expr,
    children: this.visit(node.block),
    line: node.line,
    filename: node.filename
  }
};

Compiler.prototype.visitWhen = function(node) {
  return {
    type: node.expr === 'default' ? 'default' : 'case',
    expression: node.expr !== 'default' ? node.expr : undefined,
    children: this.visit(node.block),
    line: node.line,
    filename: node.filename
  };
};

Compiler.prototype.visitLiteral = function(node) {
  return {
    type: 'expression',
    expression: node.str,
    buffer: node.buffer,
    escape: node.escape,
    line: node.line,
    filename: node.filename
  };
};

Compiler.prototype.visitBlock = function(node) {
  var length = node.nodes.length;

  var ast = [];

  for (var i = 0; i < length; ++i) {
    ast[i] = this.visit(node.nodes[i]);
  }
  return ast;
};

Compiler.prototype.visitMixinBlock = function(node, ast) {
  // TODO
  throw errorAtNode(node, new Error('Mixins are not supported at this time'));
};

Compiler.prototype.visitDoctype = function(node, ast) {
  // TODO
  throw errorAtNode(node, new Error('Doctypes are not supported at this time'));
};

Compiler.prototype.visitMixin = function(node, ast) {
  // TODO
  throw errorAtNode(node, new Error('Mixins are not supported at this time'));
};

Compiler.prototype.visitTag = function(node, ast) {
  var self = this;
  var name = node.name;

  if (node.selfClosing &&
      node.block &&
      !(node.block.type === 'Block' && node.block.nodes.length === 0) &&
      node.block.nodes.some(function(tag) {
        return tag.type !== 'Text' || !/^\s*$/.test(tag.val)
      })) {
    throw errorAtNode(node, new Error(name + ' is self closing and should not have content.'));
  }

  var children = (node.block && node.block.nodes.length && node.block.nodes || (node.code ? [node.code] : [])).map(function(child) {
    return self.visit(child);
  });

  var el = {
    type: 'tag',
    name: name,
    props: this.visitAttributes(node.attrs, node.attributeBlocks),
    children: children,
    line: node.line,
    filename: node.filename
  };

  return el;
};

Compiler.prototype.visitFilter = function(node, ast) {
  // TODO
  throw errorAtNode(node, new Error('Filters are not supported at this time'));
};

Compiler.prototype.visitText = function(node, ast) {
  // TODO interpolation
  // TODO unescape html expressions
  return {
    type: 'text',
    expression: JSON.stringify(node.val),
    line: node.line,
    filename: node.filename
  };
};

Compiler.prototype.visitComment = function(node, ast) {
  return {
    type: node.buffer ? 'comment' : 'js_comment',
    value: node.val,
    line: node.line,
    filename: node.filename
  };
};

Compiler.prototype.visitBlockComment = function(node, ast) {
  var value = node.block.nodes.map(function(comment) {
    return comment.val;
  }).join('\n');
  return {
    type: node.buffer ? 'comment' : 'js_comment',
    value: value,
    line: node.line,
    filename: node.filename
  };
};

Compiler.prototype.visitCode = function(node) {
  var self = this;
  var val = node.val;
  var type = val.slice(0, 3);
  var expr = val.slice(3);

  var children = self.visit(node.block);

  switch(type) {
  case 'IFF':
    return {
      type: 'if',
      expression: expr,
      children: children,
      line: node.line,
      filename: node.filename
    };
  case 'NIF':
    return {
      type: 'unless',
      expression: expr,
      children: children,
      line: node.line,
      filename: node.filename
    };
  case 'ELF':
    return {
      type: 'elseif',
      expression: expr,
      children: children,
      line: node.line,
      filename: node.filename
    };
  case 'ELS':
    return {
      type: 'else',
      children: children,
      line: node.line,
      filename: node.filename
    };
  case 'EXP':
    return {
      type: 'expression',
      buffer: node.buffer,
      expression: expr,
      escape: node.escape,
      line: node.line,
      filename: node.filename
    };
  }
  throw node;
};

Compiler.prototype.visitEach = function(node, ast) {
  var parts = node.val.split(/ +in +/);

  if (parts.length === 1) return {
    type: 'for',
    expression: node.val.replace(/^ *\(/, '').replace(/\) *$/, ''),
    children: node.block && this.visit(node.block)
  };

  var kv = parts[0].split(/ *\, */);

  return {
    type: 'each',
    key: (kv[1] || node.key).trim(),
    value: kv[0].trim(),
    expression: parts[1].trim(),
    children: node.block && this.visit(node.block)
  };
};

Compiler.prototype.visitAttributes = function(attrs, blocks) {
  return attrs.reduce(function(acc, attr) {
    acc[attr.name] = {
      expression: attr.val,
      escaped: attr.escaped
    };
    return acc;
  }, {});
};

function errorAtNode(node, error) {
  error.line = node.line;
  error.filename = node.filename;
  return error;
}
