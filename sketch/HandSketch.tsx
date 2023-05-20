import dynamic from "next/dynamic";
import p5Types from "p5";
import { MutableRefObject, useRef } from "react";
import { Hand } from "@tensorflow-models/hand-pose-detection";
import { getSmoothedHandpose } from "../lib/getSmoothedHandpose";
import { updateHandposeHistory } from "../lib/updateHandposeHistory";
import { Keypoint } from "@tensorflow-models/hand-pose-detection";
import { convertHandToHandpose } from "../lib/converter/convertHandToHandpose";
import { isFront } from "../lib/calculator/isFront";
import { giftwrap } from "../lib/calculator/giftwrap";
import { Monitor } from "./Monitor";

type Props = {
  handpose: MutableRefObject<Hand[]>;
};

let leftHand: Keypoint[] = [];
let rightHand: Keypoint[] = [];
let leftHandOpacity: number = 0;
let rightHandOpacity: number = 0;
const minimumFrame: number = 12;
const rightHandposes: Keypoint[][][] = [[]];
const rightHandposesHead: number[] = [0];

type Handpose = Keypoint[];

const Sketch = dynamic(import("react-p5"), {
  loading: () => <></>,
  ssr: false,
});

export const HandSketch = ({ handpose }: Props) => {
  const debugLog = useRef<{ label: string; value: any }[]>([]);
  let handposeHistory: {
    left: Handpose[];
    right: Handpose[];
  } = { left: [], right: [] };

  const preload = (p5: p5Types) => {
    // 画像などのロードを行う
  };

  const setup = (p5: p5Types, canvasParentRef: Element) => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
    p5.noStroke();
    p5.fill(255);
  };

  const draw = (p5: p5Types) => {
    // logとしてmonitorに表示する
    debugLog.current = [];
    for (const hand of handpose.current) {
      debugLog.current.push({
        label: hand.handedness + " accuracy",
        value: hand.score,
      });
      debugLog.current.push({
        label: hand.handedness + " is front",
        //@ts-ignore
        value: isFront(hand.keypoints, hand.handedness.toLowerCase()),
      });
    }

    const rawHands: {
      left: Handpose;
      right: Handpose;
    } = convertHandToHandpose(handpose.current); //平滑化されていない手指の動きを使用する
    handposeHistory = updateHandposeHistory(rawHands, handposeHistory); //handposeHistoryの更新
    const hands: {
      left: Handpose;
      right: Handpose;
    } = getSmoothedHandpose(rawHands, handposeHistory); //平滑化された手指の動きを取得する

    p5.background(1, 25, 96);
    if (hands.left.length > 0) {
      leftHand = hands.left;
      leftHandOpacity = Math.min(255, leftHandOpacity + 255 / 10);
    } else {
      leftHandOpacity = Math.max(0, leftHandOpacity - 255 / 10);
    }

    if (leftHand.length > 0) {
      p5.push();
      p5.translate(
        (leftHand[0].x * p5.width) / 600,
        (leftHand[0].y * p5.height) / 400
      );
      const indices = giftwrap(leftHand);
      p5.fill(255, leftHandOpacity);
      p5.beginShape();
      for (const index of indices) {
        p5.vertex(leftHand[index].x, leftHand[index].y);
      }
      p5.endShape(p5.CLOSE);
      p5.pop();
    }

    if (rightHandposes.length > 1) {
      //ログモーションの描画
      rightHandposes.forEach((hands, i) => {
        if (hands.length > minimumFrame && i < rightHandposes.length - 1) {
          p5.push();
          p5.translate(
            (hands[rightHandposesHead[i]][0].x * p5.width) / 600,
            (hands[rightHandposesHead[i]][0].y * p5.height) / 400
          );
          const indices = giftwrap(hands[rightHandposesHead[i]]);
          p5.beginShape();
          for (const index of indices) {
            p5.vertex(
              hands[rightHandposesHead[i]][index].x,
              hands[rightHandposesHead[i]][index].y
            );
          }
          p5.endShape(p5.CLOSE);
          p5.pop();
          rightHandposesHead[i] = (rightHandposesHead[i] + 1) % hands.length;
        }
      });
    }

    if (hands.right.length > 0) {
      rightHand = hands.right;
      rightHandOpacity = Math.min(255, rightHandOpacity + 255 / 10);
    } else {
      rightHandOpacity = Math.max(0, rightHandOpacity - 255 / 10);
      //現在記録されていたフレーム情報の破棄
      rightHandposes[rightHandposes.length - 1] = [];
    }

    if (rightHand.length > 0) {
      if (isFront(rightHand, "right")) {
        rightHandposes[rightHandposes.length - 1].push(rightHand);
      } else if (rightHandposes[rightHandposes.length - 1].length > 0) {
        rightHandposes.push([]);
        rightHandposesHead.push(0);
      }
      p5.push();
      if (isFront(rightHand, "right")) {
        p5.fill(100, rightHandOpacity);
      } else {
        p5.noFill();
        p5.stroke(255, rightHandOpacity);
        p5.strokeWeight(1);
      }
      p5.translate(
        (rightHand[0].x * p5.width) / 600,
        (rightHand[0].y * p5.height) / 400
      );
      const indices = giftwrap(rightHand);

      p5.beginShape();
      for (const index of indices) {
        p5.vertex(rightHand[index].x, rightHand[index].y);
      }
      p5.endShape(p5.CLOSE);
      p5.pop();
    }
  };

  const windowResized = (p5: p5Types) => {
    p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
  };

  return (
    <>
      <Monitor handpose={handpose} debugLog={debugLog} />
      <Sketch
        preload={preload}
        setup={setup}
        draw={draw}
        windowResized={windowResized}
      />
    </>
  );
};
