import 'reflect-metadata';
import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

@Injectable()
class DependencyService {
  public getValue(): string {
    return 'dependency-injected-value';
  }
}

@Injectable()
class ConsumerService {
  constructor(private readonly dependency: DependencyService) {}

  public getInjectedValue(): string {
    return this.dependency.getValue();
  }
}

describe('NestJS Dependency Injection & Decorator Metadata', () => {
  it('resolves constructor-injected dependencies without explicit tokens', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DependencyService, ConsumerService],
    }).compile();

    const consumer = moduleRef.get<ConsumerService>(ConsumerService);

    expect(consumer).toBeDefined();
    expect(consumer.getInjectedValue()).toBe('dependency-injected-value');

    await moduleRef.close();
  });
});
