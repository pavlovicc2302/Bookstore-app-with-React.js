import { Injectable } from '@angular/core';
import { KnjigaModel, Komentar, Status } from './knjiga.model';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, switchMap, take, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class KnjigeService {

  private _knjige = new BehaviorSubject<KnjigaModel[]>([]);
  private _komentari = new BehaviorSubject<Komentar[]>([]);

  get knjige() {
    return this._knjige.asObservable();
  }

  get komentari() {
    return this._komentari.asObservable();
  }

  constructor(private http: HttpClient, private authService: AuthService) { }

  addKnjiga(naslov: string, autor: string, isbn: string, slika: string, opis: string, cena: number, kolicina: number, status: Status) {
    let generatedId;
    return this.http.post<{ name: string }>(
      `https://knjizara-d51e5-default-rtdb.europe-west1.firebasedatabase.app/knjige.json?auth=${this.authService.getToken()}`,
      { naslov, autor, isbn, slika, opis, cena, kolicina, status }
    ).pipe(
      switchMap((resData) => {
        generatedId = resData.name;
        return this.knjige;
      }),
      take(1),
      tap((knjige) => {
        this._knjige.next(
          knjige.concat({
            id: generatedId,
            naslov, autor, isbn, slika, opis, cena, kolicina, status
          })
        );
      })
    );
  }

  getKnjige(status:Status) {
    return this.http
      .get<{ [key: string]: KnjigaModel }>(
        `https://knjizara-d51e5-default-rtdb.europe-west1.firebasedatabase.app/knjige.json?auth=${this.authService.getToken()}`
      )
      .pipe(map((knjigeData: any) => {
        const knjige: KnjigaModel[] = [];
        for (const key in knjigeData) {
          const knjigaData = knjigeData[key];
          if (knjigaData.status === Status[status]) {
            knjige.push({
              id: key,
              autor: knjigaData.autor,
              naslov: knjigaData.naslov,
              isbn: knjigaData.isbn,
              slika: knjigaData.slika,
              opis: knjigaData.opis,
              cena: knjigaData.cena,
              kolicina: knjigaData.kolicina,
              status: knjigaData.status,
            });
          }
        }
        this._knjige.next(knjige);
        return knjige;
      })
      );
  }

  getKnjiga(id: string) {
    return this.http
      .get(
        `https://knjizara-d51e5-default-rtdb.europe-west1.firebasedatabase.app/knjige/${id}.json?auth=${this.authService.getToken()}`
      )
      .pipe(
        map((resData: any) => {
          return {
            id,
            autor: resData.autor,
            naslov: resData.naslov,
            isbn: resData.isbn,
            slika: resData.slika,
            opis: resData.opis,
            cena: resData.cena,
            kolicina: resData.kolicina,
            status: resData.status,
          };
        })
      );
  }

  updateKnjiga(id: string, updatedKnjiga: Partial<KnjigaModel>) {
    const updatedKnjigaToSend = {
      ...updatedKnjiga,
      status: updatedKnjiga.status ? Status[updatedKnjiga.status] : undefined
    };

    return this.http
      .patch(
        `https://knjizara-d51e5-default-rtdb.europe-west1.firebasedatabase.app/knjige/${id}.json?auth=${this.authService.getToken()}`,
        updatedKnjigaToSend
      )
      .pipe(
        switchMap(() => this.knjige),
        take(1),
        tap(knjige => {
          const updatedKnjigeIndex = knjige.findIndex(k => k.id === id);
          const updatedKnjige = [...knjige];
          const knjigaToUpdate = {
            ...knjige[updatedKnjigeIndex],
            ...updatedKnjiga
          };
          updatedKnjige[updatedKnjigeIndex] = knjigaToUpdate;
          this._knjige.next(updatedKnjige);

          if (updatedKnjiga.kolicina === 0) {
            this.promeniStatusKnjige(id, Status.Nema_na_lageru).subscribe();
          }

        })
      )
  }

  promeniStatusKnjige(id: string, status: Status) {
    const knjiga = this._knjige.value.find(k => k.id === id);
    if (!knjiga) {
      console.error('Knjiga nije pronađena.');
      return null;
    }
    knjiga.status = status;
    return this.http.patch(
      `https://knjizara-d51e5-default-rtdb.europe-west1.firebasedatabase.app/knjige/${id}.json?auth=${this.authService.getToken()}`,
      { status: Status[status] }
    ).pipe(
      tap(() => {
        this._knjige.next([...this._knjige.value]);
      })
    );
  }

  addKomentar(userId: string, korisnik: string, knjigaId: string, komentar: string ) {
    let generatedId: string;
    return this.http.post<{name:string}>(
      `https://knjizara-d51e5-default-rtdb.europe-west1.firebasedatabase.app/komentari.json?auth=${this.authService.getToken()}`,
      { userId, korisnik, knjigaId, komentar}
    ).pipe(
      switchMap((resData) => {
        generatedId = resData.name;
        return this.komentari;
      }),
      take(1),
      tap((komentari) => {
        this._komentari.next(
          komentari.concat({
            id: generatedId,
            userId,
            korisnik,
            knjigaId,
            komentar
          })
        );
      })
    );
  }

  deleteKomentar(id: string): Observable<void> {
    const url = `https://knjizara-d51e5-default-rtdb.europe-west1.firebasedatabase.app/komentari/${id}.json?auth=${this.authService.getToken()}`;
    return this.http.delete<void>(url).pipe(
      tap(() => {
        const updatedKomentari = this._komentari.value.filter(k => k.id !== id);
        this._komentari.next(updatedKomentari);
      })
    );
  }
  
  getKomentare(knjigaId: string) {
    return this.http.get<{ [key: string]: Komentar }>(
      `https://knjizara-d51e5-default-rtdb.europe-west1.firebasedatabase.app/komentari.json?auth=${this.authService.getToken()}&orderBy="knjigaId"&equalTo="${knjigaId}"`
    ).pipe(
      map((komentarData) => {
        const komentari: Komentar[] = [];
        for (const key in komentarData) {
          if (komentarData.hasOwnProperty(key)) {
            komentari.push({ 
              id: key, 
              userId: komentarData[key].userId,
              korisnik: komentarData[key].korisnik,
              knjigaId: komentarData[key].knjigaId,
              komentar: komentarData[key].komentar,
            });
          }
        }
        console.log(komentari);
        this._komentari.next(komentari);
        return komentari;
      })
    );
  }
}
