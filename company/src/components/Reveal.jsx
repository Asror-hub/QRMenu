import { useEffect, useRef, useState } from "react";

export function Reveal({
  as: Comp = "div",
  variant = "up",
  children,
  className = "",
  delay = 0,
  style: styleProp,
  role,
  ...rest
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setVisible(true);
      return;
    }
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          ob.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -14% 0px", threshold: 0.08 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const style = { ...styleProp, ...(delay ? { transitionDelay: `${delay}ms` } : {}) };

  return (
    <Comp
      ref={ref}
      {...rest}
      role={role}
      className={`reveal reveal--${variant}${visible ? " reveal--visible" : ""}${className ? ` ${className}` : ""}`.trim()}
      style={style}
    >
      {children}
    </Comp>
  );
}
