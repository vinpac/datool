declare module '*.module.css' {
  const classes: Record<string, string>;

  export default classes;
}

declare module '*.svg' {
  const content: { src: string };

  export default content;
}
