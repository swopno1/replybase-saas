import { Adapter, AdapterPayload } from "oidc-provider";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class PrismaOIDCAdapter implements Adapter {
  model: string;

  constructor(modelName: string) {
    this.model = modelName;
  }

  async upsert(
    id: string,
    payload: AdapterPayload,
    expiresIn: number,
  ): Promise<void> {
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    await prisma.oidcModel.upsert({
      where: {
        type_id: {
          type: this.model,
          id,
        },
      },
      update: {
        payload: payload as Prisma.InputJsonValue,
        expiresAt,
        grantId: payload.grantId,
        userCode: payload.userCode,
        uid: payload.uid,
        updatedAt: new Date(),
      },
      create: {
        id,
        type: this.model,
        payload: payload as Prisma.InputJsonValue,
        expiresAt,
        grantId: payload.grantId,
        userCode: payload.userCode,
        uid: payload.uid,
      },
    });
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const doc = await prisma.oidcModel.findUnique({
      where: {
        type_id: {
          type: this.model,
          id,
        },
      },
    });

    if (!doc || (doc.expiresAt && doc.expiresAt < new Date())) {
      return undefined;
    }

    return doc.payload as AdapterPayload;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const doc = await prisma.oidcModel.findFirst({
      where: {
        userCode,
        type: this.model,
      },
    });

    if (!doc || (doc.expiresAt && doc.expiresAt < new Date())) {
      return undefined;
    }

    return doc.payload as AdapterPayload;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const doc = await prisma.oidcModel.findFirst({
      where: {
        uid,
        type: this.model,
      },
    });

    if (!doc || (doc.expiresAt && doc.expiresAt < new Date())) {
      return undefined;
    }

    return doc.payload as AdapterPayload;
  }

  async destroy(id: string): Promise<void> {
    try {
      await prisma.oidcModel.delete({
        where: {
          type_id: {
            type: this.model,
            id,
          },
        },
      });
    } catch (err) {
      // Ignore if not found
    }
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await prisma.oidcModel.deleteMany({
      where: {
        grantId,
      },
    });
  }

  async consume(id: string): Promise<void> {
    await prisma.oidcModel.update({
      where: {
        type_id: {
          type: this.model,
          id,
        },
      },
      data: {
        consumedAt: new Date(),
      },
    });
  }
}
