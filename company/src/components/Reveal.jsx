import { useEffect, useRef, useState } from "react";

export function Reveal({ children, className = "", delay = 0, style: styleProp, role, ...rest }) {
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
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.06 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const style = { ...styleProp, ...(delay ? { transitionDelay: `${delay}ms` } : {}) };

  return (
    <div
      ref={ref}
      {...rest}
      role={role}
      className={`reveal${visible ? " reveal--visible" : ""}${className ? ` ${className}` : ""}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
