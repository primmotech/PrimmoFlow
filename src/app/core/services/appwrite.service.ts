// src/app/core/services/appwrite.service.ts
import { Injectable } from '@angular/core';
import { Client, Account, Databases, Storage } from 'appwrite';

@Injectable({
  providedIn: 'root'
})
export class AppwriteService {
  public client = new Client();
  public account: Account;
  public databases: Databases;
  public storage: Storage;

  constructor() {
    this.client
      .setEndpoint('https://fra.cloud.appwrite.io/v1') // Ton endpoint
      .setProject('694eb89e001a66c2311f');               // Ton ID de projet

    this.account = new Account(this.client);
    this.databases = new Databases(this.client);
    this.storage = new Storage(this.client);
  }
}