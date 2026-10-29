import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { Container, Graphics, Text, TextStyle, type Application } from "pixi.js";
import type { Task } from "../../types";
import { CEO_SIZE, DESK_H, type Delivery } from "./model";
import { drawOfficeMascot } from "./drawOfficeAvatar";

interface BuildFinalLayersParams {
  app: Application;
  tasks: Task[];
  ceoPosRef: MutableRefObject<{ x: number; y: number }>;
  agentPosRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  deliveriesRef: MutableRefObject<Delivery[]>;
  deliveryLayerRef: MutableRefObject<Container | null>;
  highlightRef: MutableRefObject<Graphics | null>;
  ceoSpriteRef: MutableRefObject<Container | null>;
  crownRef: MutableRefObject<Graphics | null>;
  prevAssignRef: MutableRefObject<Set<string>>;
  setSceneRevision: Dispatch<SetStateAction<number>>;
}

export function buildFinalLayers({
  app,
  tasks,
  ceoPosRef,
  agentPosRef,
  deliveriesRef,
  deliveryLayerRef,
  highlightRef,
  ceoSpriteRef,
  crownRef,
  prevAssignRef,
  setSceneRevision,
}: BuildFinalLayersParams): void {
  const deliveryLayer = new Container();
  app.stage.addChild(deliveryLayer);
  deliveryLayerRef.current = deliveryLayer;

  deliveriesRef.current = deliveriesRef.current.filter((delivery) => !delivery.sprite.destroyed);
  for (const delivery of deliveriesRef.current) {
    deliveryLayer.addChild(delivery.sprite);
  }

  const highlight = new Graphics();
  app.stage.addChild(highlight);
  highlightRef.current = highlight;

  const ceoCharacter = drawOfficeMascot(CEO_SIZE);

  const crown = new Graphics();
  crown.moveTo(-7, 0).lineTo(-6, -7).lineTo(-2, -3).lineTo(0, -9).lineTo(3, -3).lineTo(7, -7).lineTo(7, 0).closePath().fill(0xf2bb43);
  crown.roundRect(-7, -1, 14, 3, 1).fill(0xffd566);
  crown.position.set(0, -CEO_SIZE / 2 + 2);
  ceoCharacter.addChild(crown);
  crownRef.current = crown;

  const nameBadge = new Graphics();
  nameBadge.roundRect(-16, CEO_SIZE / 2 + 1, 32, 11, 3).fill({ color: 0xf0d888, alpha: 0.9 });
  ceoCharacter.addChild(nameBadge);
  const nameText = new Text({
    text: "CEO",
    style: new TextStyle({ fontSize: 7, fill: 0x5a4020, fontWeight: "bold", fontFamily: "monospace" }),
  });
  nameText.anchor.set(0.5, 0.5);
  nameText.position.set(0, CEO_SIZE / 2 + 6.5);
  ceoCharacter.addChild(nameText);

  ceoCharacter.position.set(ceoPosRef.current.x, ceoPosRef.current.y);
  app.stage.addChild(ceoCharacter);
  ceoSpriteRef.current = ceoCharacter;

  const currentAssign = new Set(
    tasks.filter((task) => task.assigned_agent_id && task.status === "in_progress").map((task) => task.id),
  );
  const newAssigns = [...currentAssign].filter((id) => !prevAssignRef.current.has(id));
  prevAssignRef.current = currentAssign;

  for (const taskId of newAssigns) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task?.assigned_agent_id) continue;
    const target = agentPosRef.current.get(task.assigned_agent_id);
    if (!target) continue;

    const deliverySprite = new Container();
    const docEmoji = new Text({ text: "📋", style: new TextStyle({ fontSize: 16 }) });
    docEmoji.anchor.set(0.5, 0.5);
    deliverySprite.addChild(docEmoji);
    deliverySprite.position.set(ceoPosRef.current.x, ceoPosRef.current.y);
    deliveryLayer.addChild(deliverySprite);

    deliveriesRef.current.push({
      sprite: deliverySprite,
      fromX: ceoPosRef.current.x,
      fromY: ceoPosRef.current.y,
      toX: target.x,
      toY: target.y + DESK_H,
      progress: 0,
    });
  }

  setSceneRevision((prev) => prev + 1);
}
