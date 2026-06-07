import React, { useRef } from 'react';
import { CSSTransition } from 'react-transition-group';

interface Props {
  in?: boolean;
  children: React.ReactNode;
}

const Fade: React.FC<Props> = (props) => {
  const nodeRef = useRef(null);

  return (
    <CSSTransition in={props.in} nodeRef={nodeRef} classNames="transition-fade" timeout={{ enter: 300, exit: 200 }} unmountOnExit>
      <span ref={nodeRef} style={{ display: 'block', width: '100%', height: '100%' }}>{props.children}</span>
    </CSSTransition>
  );
};

export default Fade;
