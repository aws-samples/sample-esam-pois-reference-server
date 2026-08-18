// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

export function formatXml(xml: string): string {
  const PADDING = '  ';
  const reg = /(>)(<)(\/*)/g;
  let formatted = '';
  let pad = 0;

  xml = xml.replace(reg, '$1\n$2$3');
  
  xml.split('\n').forEach((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/) && pad > 0) {
      pad -= 1;
    } else if (node.match(/^<\w[^>]*[^/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    formatted += PADDING.repeat(pad) + node + '\n';
    pad += indent;
  });

  return formatted.trim();
}

export function highlightXml(xml: string): string {
  const formatted = formatXml(xml);
  
  return formatted
    .replace(/(&lt;)([^&\s]+)([^&]*?)(&gt;)/g, '<span class="text-blue-400">$1$2</span><span class="text-green-400">$3</span><span class="text-blue-400">$4</span>')
    .replace(/(&lt;\/[^&]+&gt;)/g, '<span class="text-blue-400">$1</span>')
    .replace(/([a-zA-Z-]+)=&quot;([^&quot;]*)&quot;/g, '<span class="text-purple-400">$1</span>=<span class="text-yellow-300">&quot;$2&quot;</span>');
}
